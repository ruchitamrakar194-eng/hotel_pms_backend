const mewsService = require('./mewsService');
const guestService = require('./guestService');
const conversationService = require('./conversationService');
const whatsappService = require('./whatsappService');
const emailService = require('./emailService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { OpenAI } = require('openai');
const vectorDb = require('../utils/vectorDb');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class AutomationEngine {
  
  // ==========================================
  // MIDDLEWARE: OWNERSHIP & SECURITY
  // ==========================================
  async _ownershipMiddleware(hotelId, guest, reservationId) {
    if (!guest.pmsGuestId) {
      throw new Error("Guest is not linked to PMS.");
    }
    // Fetch once and cache in execution context conceptually
    const reservation = await mewsService.getReservation(hotelId, reservationId);
    if (!reservation) {
       throw new Error("Reservation not found.");
    }
    // Check if the reservation returned contains the customer
    // The Mews API usually returns an array of Reservations.
    let targetRes = Array.isArray(reservation.Reservations) ? reservation.Reservations.find(r => r.Id === reservationId) : reservation;
    if (!targetRes) targetRes = reservation.Reservations ? reservation.Reservations[0] : null;
    
    if (targetRes && targetRes.CustomerId !== guest.pmsGuestId) {
      // Emit Telemetry
      await prisma.activityLog.create({
        data: {
          conversationId: 0,
          actionType: "IDENTITY_VIOLATION_BLOCKED",
          actionDetails: `Attempted access to Res ${reservationId} by guest ${guest.pmsGuestId}`,
        }
      });
      throw new Error("Unauthorized: Reservation does not belong to verified guest.");
    }
    return targetRes;
  }

  // ==========================================
  // MIDDLEWARE: IDEMPOTENCY ENGINE & TRANSACTION SENTINEL
  // ==========================================
  async _withIdempotency(toolCallId, conversationId, hotelId, guestId, toolName, requestPayload, executionBlock) {
    const crypto = require('crypto');
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(requestPayload)).digest('hex');

    try {
      let log = await prisma.toolExecutionLog.findUnique({ where: { toolCallId } });
      if (log) {
        if (log.status === "SUCCESS") return JSON.parse(log.responsePayload);
        if (log.status === "PENDING") throw new Error("Concurrency Block: Duplicate execution attempt while PENDING.");
      }

      // Hash Verifier (Duplicate Payload Check)
      const fiveMinsAgo = new Date(Date.now() - 300000);
      const duplicateState = await prisma.transactionStateLog.findFirst({
        where: { payloadHash, createdAt: { gt: fiveMinsAgo } }
      });
      if (duplicateState && duplicateState.state === 'DB_COMMITTED') {
         await prisma.activityLog.create({ data: { conversationId, actionType: "DUPLICATE_PAYLOAD_HALTED", actionDetails: "Hash match detected." } });
         const dupeLog = await prisma.toolExecutionLog.findUnique({ where: { toolCallId: duplicateState.toolCallId } });
         return JSON.parse(dupeLog.responsePayload);
      }

      log = await prisma.toolExecutionLog.create({
        data: { toolCallId, conversationId, hotelId, guestId, toolName, requestPayload: JSON.stringify(requestPayload), status: "PENDING" }
      });

      // Distributed Transaction Sentinel: PRE_FLIGHT
      const stateLog = await prisma.transactionStateLog.create({
        data: { toolCallId, payloadHash, category: "EXECUTION", state: "PRE_FLIGHT" }
      });

      let resultObj;
      try {
        resultObj = await executionBlock();
        await prisma.transactionStateLog.update({ where: { toolCallId }, data: { state: "MEWS_EXECUTED" } });
      } catch (err) {
        if (err.classification === "AMBIGUOUS") {
           await prisma.transactionStateLog.update({ where: { toolCallId }, data: { state: "AMBIGUOUS" } });
           throw new Error("PMS is processing your request. Please hold.");
        }
        throw err;
      }

      await prisma.toolExecutionLog.update({
        where: { toolCallId },
        data: { status: "SUCCESS", responsePayload: JSON.stringify(resultObj), mewsEntityId: resultObj.data?.reservationId || null }
      });

      await prisma.transactionStateLog.update({ where: { toolCallId }, data: { state: "DB_COMMITTED" } });
      return resultObj;
    } catch (e) {
      await prisma.toolExecutionLog.update({
        where: { toolCallId }, data: { status: "FAILED", responsePayload: JSON.stringify({ error: e.message }) }
      });
      throw e;
    }
  }

  // ==========================================
  // INGESTION PIPELINE
  // ==========================================
  async handleIncomingMessage(hotelId, senderIdentity, content, channel = 'WhatsApp', emailMessageId = null, emailInReplyTo = null) {
    if (!hotelId) throw new Error("hotelId is required for AutomationEngine");

    // 1. Identify guest
    let guest = await guestService.findByIdentity(senderIdentity);
    if (!guest) {
      try {
        const mewsProfiles = await mewsService.getGuestProfile(hotelId, senderIdentity);
        if (mewsProfiles && mewsProfiles.Customers && mewsProfiles.Customers.length > 0) {
          const mCustomer = mewsProfiles.Customers[0];
          guest = await guestService.createGuest({
            name: `${mCustomer.FirstName} ${mCustomer.LastName}`,
            email: mCustomer.Email,
            phone: mCustomer.Telephone,
            pmsGuestId: mCustomer.Id
          });
        }
      } catch (e) {
        console.error("Mews profile lookup failed:", e.message);
      }
    }
    if (!guest) {
      guest = await guestService.createGuest({
        name: 'Unknown Guest',
        phone: channel === 'Email' ? 'No Phone' : senderIdentity,
        email: channel === 'Email' ? senderIdentity : null,
        status: 'Unidentified'
      });
    }

    // 2. Find or Create Conversation
    const conversation = await conversationService.findOrCreateConversation(guest.id);
    
    // 3. Store Message
    await conversationService.addMessage(conversation.id, 'guest', content, channel, null, null, emailMessageId, emailInReplyTo);
    await conversationService.logActivity(conversation.id, 'Message Received', `Channel: ${channel}`);

    if (!conversation.aiEnabled || conversation.status === 'escalated') {
      console.log(`[AutomationEngine] AI response bypassed: conversation ${conversation.id} is managed by human.`);
      return { success: true, message: 'Message logged. Managed by human operator.', automated: false };
    }

    // 4. Decision Logic (OpenAI)
    try {
      const decision = await this._decideWithAI(hotelId, conversation, guest, content, channel);
      
      if (decision.action === 'auto_reply') {
        // Guard: skip saving/sending if AI produced empty response
        if (!decision.response || !decision.response.trim()) {
          console.warn(`[AutomationEngine] AI returned empty response for Hotel ${hotelId}. Skipping message dispatch.`);
          return { success: false, error: 'AI returned empty response' };
        }
        
        let outEmailMsgId = null;
        if (channel === 'Email') {
          try {
            const subject = `Inquiry regarding your stay`;
            const info = await emailService.sendGuestEmail(guest.email || senderIdentity, subject, `<p>${decision.response.replace(/\n/g, '<br>')}</p>`, emailMessageId, emailMessageId, hotelId);
            outEmailMsgId = info?.messageId || null;
          } catch (err) {
            console.error('Failed to dispatch Email message:', err.message);
          }
        } else if (channel === 'WhatsApp') {
          try { await whatsappService.sendMessage(hotelId, guest.phone, decision.response); } 
          catch (err) { console.error('Failed to dispatch WhatsApp message:', err.message); }
        }

        await conversationService.addMessage(conversation.id, 'ai', decision.response, channel, null, null, outEmailMsgId, emailMessageId);
        await conversationService.logActivity(conversation.id, 'AI Response', `Tool Used: ${decision.tool || 'none'}`);
        
        return { success: true, response: decision.response, automated: true };
      } else {
        await conversationService.updateStatus(conversation.id, 'escalated', 0);
        await conversationService.logActivity(conversation.id, 'Escalation', `Reason: ${decision.reason}`);
        
        const handoffMessage = "I am transferring your request to a human operator. A staff member will review this and get back to you shortly.";
        let outEmailMsgId = null;

        if (channel === 'Email') {
          try {
            const subject = `Transferring to Guest Services`;
            const info = await emailService.sendGuestEmail(guest.email || senderIdentity, subject, `<p>${handoffMessage}</p>`, emailMessageId, emailMessageId, hotelId);
            outEmailMsgId = info?.messageId || null;
          } catch (err) {
            console.error('Failed to dispatch Escalation Email message:', err.message);
          }
        } else if (channel === 'WhatsApp') {
          try {
            await whatsappService.sendMessage(hotelId, guest.phone, handoffMessage);
          } catch (err) {
            console.error('Failed to dispatch Escalation WhatsApp message:', err.message);
          }
        }

        await conversationService.addMessage(conversation.id, 'ai', handoffMessage, channel, null, null, outEmailMsgId, emailMessageId);

        return { success: true, response: handoffMessage, automated: false };
      }
    } catch (error) {
      console.error('Automation Engine AI Error:', error);
      await conversationService.updateStatus(conversation.id, 'escalated', 0);
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // DISPATCHER & OPENAI ORCHESTRATION
  // ==========================================
  async _decideWithAI(hotelId, conversation, guest, content, channel) {
    const bookingState = await prisma.bookingState.findUnique({
      where: { conversationId: conversation.id }
    });

    const TOOLS_SCHEMA = [
      { type: "function", function: { name: "escalate_to_human", description: "Escalate to human.", parameters: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] } } },
      { type: "function", function: { name: "query_hotel_knowledge_base", description: "Search policies.", parameters: { type: "object", properties: { search_query: { type: "string" } }, required: ["search_query"] } } },
      { type: "function", function: { name: "get_guest_profile", description: "Get guest details.", parameters: { type: "object", properties: {} } } },
      { type: "function", function: { name: "create_guest_profile", description: "Create a PMS profile so the guest can book rooms.", parameters: { type: "object", properties: { firstName: { type: "string" }, lastName: { type: "string" }, email: { type: "string" } }, required: ["firstName", "lastName", "email"] } } },
      { type: "function", function: { name: "update_guest_profile", description: "Update guest profile.", parameters: { type: "object", properties: { email: { type: "string" } } } } },
      { type: "function", function: { name: "update_guest_notes", description: "Add notes to profile.", parameters: { type: "object", properties: { notes: { type: "string" } }, required: ["notes"] } } },
      { type: "function", function: { name: "check_room_availability", description: "Check room availability. Dates MUST be ISO 8601 UTC (e.g., 2026-06-02T15:00:00Z).", parameters: { type: "object", properties: { startDate: { type: "string" }, endDate: { type: "string" }, serviceId: { type: "string" } }, required: ["startDate", "endDate", "serviceId"] } } },
      { type: "function", function: { name: "quote_price", description: "Quote price for dates.", parameters: { type: "object", properties: { startDate: { type: "string" }, endDate: { type: "string" }, serviceId: { type: "string" } }, required: ["startDate", "endDate", "serviceId"] } } },
      { type: "function", function: { name: "check_rate_plan", description: "Check rate plans.", parameters: { type: "object", properties: { serviceId: { type: "string" } }, required: ["serviceId"] } } },
      { type: "function", function: { name: "get_available_services", description: "Get hotel services. 'Reservable' type means hotel rooms.", parameters: { type: "object", properties: {} } } },
      { type: "function", function: { name: "find_reservation", description: "List all active stays.", parameters: { type: "object", properties: {} } } },
      { type: "function", function: { name: "get_reservation_by_customer", description: "Get reservations for customer.", parameters: { type: "object", properties: {} } } },
      { type: "function", function: { name: "get_cancellation_policy", description: "Get cancellation policy.", parameters: { type: "object", properties: { rateId: { type: "string" } }, required: ["rateId"] } } },
      { type: "function", function: { name: "create_reservation", description: "Create reservation. Dates MUST be ISO 8601 UTC (e.g., 2026-06-02T15:00:00Z).", parameters: { type: "object", properties: { serviceId: { type: "string" }, startDate: { type: "string" }, endDate: { type: "string" } }, required: ["serviceId", "startDate", "endDate"] } } },
      { type: "function", function: { name: "modify_reservation", description: "Modify reservation dates.", parameters: { type: "object", properties: { reservationId: { type: "string" }, endUtc: { type: "string" } }, required: ["reservationId", "endUtc"] } } },
      { type: "function", function: { name: "cancel_reservation", description: "Cancel reservation.", parameters: { type: "object", properties: { reservationId: { type: "string" }, reason: { type: "string" } }, required: ["reservationId", "reason"] } } },
      { type: "function", function: { name: "create_service_reservation", description: "Book spa/breakfast.", parameters: { type: "object", properties: { serviceId: { type: "string" }, startDate: { type: "string" }, endDate: { type: "string" } }, required: ["serviceId", "startDate", "endDate"] } } },
      { type: "function", function: { name: "check_in_guest", description: "Check in guest.", parameters: { type: "object", properties: { reservationId: { type: "string" } }, required: ["reservationId"] } } },
      { type: "function", function: { name: "check_out_guest", description: "Check out guest.", parameters: { type: "object", properties: { reservationId: { type: "string" } }, required: ["reservationId"] } } },
      { type: "function", function: { name: "check_late_checkout", description: "Check late checkout.", parameters: { type: "object", properties: {} } } },
      { type: "function", function: { name: "confirm_late_checkout", description: "Confirm late checkout.", parameters: { type: "object", properties: { time: { type: "string" } }, required: ["time"] } } },
      { type: "function", function: { name: "get_folio_balance", description: "Get outstanding balance.", parameters: { type: "object", properties: {} } } },
      { type: "function", function: { name: "send_payment_link", description: "Generate payment link.", parameters: { type: "object", properties: { amount: { type: "number" } }, required: ["amount"] } } },
      { type: "function", function: { name: "amend_payment", description: "Amend a payment.", parameters: { type: "object", properties: { paymentId: { type: "string" } }, required: ["paymentId"] } } },
      { type: "function", function: { name: "post_charge", description: "Post a charge.", parameters: { type: "object", properties: { serviceId: { type: "string" }, amount: { type: "number" } }, required: ["serviceId", "amount"] } } },
      {
        type: "function",
        function: {
          name: "update_booking_state",
          description: "Update the structured booking state parameters. Call this whenever the guest provides or updates their check-in/out dates, guest count, room type, or selected room/rate IDs.",
          parameters: {
            type: "object",
            properties: {
              checkInDate: { type: "string", description: "ISO 8601 UTC date string (e.g. 2026-06-18T15:00:00Z)" },
              checkOutDate: { type: "string", description: "ISO 8601 UTC date string (e.g. 2026-06-20T11:00:00Z)" },
              adults: { type: "integer" },
              children: { type: "integer" },
              roomType: { type: "string" },
              selectedRoomId: { type: "string" },
              selectedRateId: { type: "string" }
            }
          }
        }
      }
    ];

    const ALLOWLIST = TOOLS_SCHEMA.map(t => t.function.name);

    const activeBookingStateText = bookingState ? `
CURRENT ACTIVE BOOKING STATE (Use these parameters for booking/availability search tools. Do not prompt the guest for these if they are already present here, unless they wish to change them):
- Check-in Date: ${bookingState.checkInDate ? bookingState.checkInDate.toISOString() : 'Not provided'}
- Check-out Date: ${bookingState.checkOutDate ? bookingState.checkOutDate.toISOString() : 'Not provided'}
- Adults: ${bookingState.adults || 'Not provided'}
- Children: ${bookingState.children || 0}
- Room Type: ${bookingState.roomType || 'Not provided'}
- Selected Room ID: ${bookingState.selectedRoomId || 'Not provided'}
- Selected Rate ID: ${bookingState.selectedRateId || 'Not provided'}
` : '';

    const systemPrompt = `You are a Hotel AI Concierge for a luxury hotel. Your job is to help guests with information and requests.

INFORMATION REQUESTS (Category A):
- When a guest asks about hotel policies, checkout times, check-in, breakfast, wifi, cancellations, pets, or any hotel information, ALWAYS call query_hotel_knowledge_base first.
- After calling query_hotel_knowledge_base, use the returned content to give the guest a clear, helpful, and complete answer. Do NOT say you couldn't find the information if the tool returned content.
- If the tool explicitly returns "No specific policy found.", only then say you don't have that specific information.

OPERATIONS (Category B):
- For booking rooms, checking availability, creating/modifying/cancelling reservations, checking in, checking out, viewing bills, making payments — use the exact operational tools.
- Never assume or invent booking availability, pricing, or reservation success. Always call the appropriate tool and report back the actual result.

ESCALATION (Category C):
- Escalate to a human agent for disputes, refunds, complex complaints, or anything requiring management approval.

ALWAYS respond in a warm, professional, concise hotel concierge tone. Use the information from tools to give confident, direct answers.
${activeBookingStateText}`;

    const dbHistory = await conversationService.getRecentMessages(conversation.id, 50);
    const formattedHistory = [];
    
    for (let i = 0; i < dbHistory.length; i++) {
       const msg = dbHistory[i];
       if (i === dbHistory.length - 1 && msg.senderType === 'guest' && msg.content === content) continue; 
       
       if (msg.senderType === 'guest') {
         formattedHistory.push({ role: 'user', content: msg.content });
       } else if (msg.senderType === 'ai') {
         const aiMsg = { role: 'assistant', content: msg.content || "" };
         if (msg.toolCalls) {
           aiMsg.tool_calls = typeof msg.toolCalls === 'string' ? JSON.parse(msg.toolCalls) : msg.toolCalls;
         }
         formattedHistory.push(aiMsg);
       } else if (msg.senderType === 'tool') {
         formattedHistory.push({ role: 'tool', tool_call_id: msg.toolCallId, content: msg.content });
       }
    }

    // Sequence Repair Validation
    const repairedHistory = [];
    let pendingToolCalls = [];
    
    for (const msg of formattedHistory) {
      // If we have pending tool calls and the next message is NOT a tool message,
      // we MUST close the pending tool calls immediately before adding the new message.
      if (pendingToolCalls.length > 0 && msg.role !== 'tool') {
        for (const orphan of pendingToolCalls) {
          repairedHistory.push({
            role: 'tool',
            tool_call_id: orphan.id,
            name: orphan.function.name,
            content: JSON.stringify({ status: "error", message: "Execution interrupted or escalated." })
          });
        }
        pendingToolCalls = []; // clear them so they aren't processed again
      }

      if (msg.role === 'assistant' && msg.tool_calls) {
        pendingToolCalls = [...msg.tool_calls];
      }
      if (msg.role === 'tool') {
        pendingToolCalls = pendingToolCalls.filter(tc => tc.id !== msg.tool_call_id);
      }
      repairedHistory.push(msg);
    }
    
    // If there are still pending tool calls at the very end of history
    for (const orphan of pendingToolCalls) {
      repairedHistory.push({
        role: 'tool',
        tool_call_id: orphan.id,
        name: orphan.function.name,
        content: JSON.stringify({ status: "error", message: "Execution interrupted or escalated." })
      });
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...repairedHistory,
      { role: "user", content }
    ];

    let currentResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      tools: TOOLS_SCHEMA,
      tool_choice: "auto",
    });

    let iterations = 0;
    let allUsedTools = [];
    
    while (currentResponse.choices[0].message.tool_calls && iterations < 5) {
      iterations++;
      const responseMessage = currentResponse.choices[0].message;
      messages.push(responseMessage);
      
      await conversationService.addMessage(conversation.id, 'ai', "", channel, responseMessage.tool_calls, null);
      
      for (const toolCall of responseMessage.tool_calls) {
        allUsedTools.push(toolCall.function.name);
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
        
        let resultObj;

        if (functionName === "escalate_to_human") {
          return { action: 'escalate', reason: functionArgs.reason || 'Escalated by AI' };
        }

        if (!ALLOWLIST.includes(functionName)) {
          resultObj = { status: "error", message: "Tool not in allowlist." };
        } else {
          const mappedName = "_tool" + functionName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
          
          if (typeof this[mappedName] !== 'function') {
            resultObj = { status: "error", message: `Tool handler missing for ${functionName}.` };
          } else {
            try {
              // Wrap mutations in idempotency and lock context implicitly via the tool method
              resultObj = await this[mappedName](hotelId, guest, functionArgs, { conversationId: conversation.id, toolCallId: toolCall.id });
            } catch (err) {
              console.error(`Tool execution error [${functionName}]:`, err);
              resultObj = { status: "error", message: err.message || "Internal execution failed." };
            }
          }
        }
        
        const resultString = JSON.stringify(resultObj);
        messages.push({ role: "tool", tool_call_id: toolCall.id, name: functionName, content: resultString });
        
        await conversationService.addMessage(conversation.id, 'tool', resultString, channel, null, toolCall.id);
      }

      currentResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        tools: TOOLS_SCHEMA,
        tool_choice: "auto",
      });
    }

    const finalContent = currentResponse.choices[0].message.content;
    if (!finalContent || !finalContent.trim()) {
      // AI ended on a tool call with no final text — treat as escalation to avoid empty messages
      return { action: 'escalate', reason: 'AI did not produce a final text response after tool execution.' };
    }
    return { action: 'auto_reply', response: finalContent, tool: allUsedTools.join(', ') || 'none' };
  }

  // ==========================================
  // TOOL IMPLEMENTATIONS
  // ==========================================
  
  async _toolQueryHotelKnowledgeBase(hotelId, guest, args, context) {
    try {
      const q = await openai.embeddings.create({ model: "text-embedding-3-small", input: args.search_query, dimensions: 1024 });
      const vector = q.data[0].embedding;
      const matches = await vectorDb.querySimilarEmbeddings(vector, hotelId, 6);
      if (matches.length > 0) {
        // Deduplicate by content prefix to avoid sending same chunk multiple times
        const seen = new Set();
        const uniqueChunks = matches.filter(m => {
          const key = m.metadata.content.substring(0, 100);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return { status: "success", data: uniqueChunks.map(m => m.metadata.content).join("\n\n---\n\n") };
      }
      return { status: "success", data: "No specific policy found." };
    } catch (e) { 
      console.error('[Automation Engine] RAG query failed:', e);
      return { status: "error", message: "Knowledge base error." }; 
    }
  }


  async _toolGetGuestProfile(hotelId, guest, args, context) {
    if (!guest.pmsGuestId) return { status: "error", message: "No PMS profile." };
    const mewsProfiles = await mewsService.getGuestProfile(hotelId, guest.email || guest.phone);
    return { status: "success", data: mewsProfiles };
  }

  async _toolCreateGuestProfile(hotelId, guest, args, context) {
    return this._withIdempotency(context.toolCallId, context.conversationId, hotelId, guest.id, "create_guest_profile", args, async () => {
      if (guest.pmsGuestId) return { status: "success", data: "Guest already has a PMS profile." };
      
      let pmsId = null;
      try {
        const res = await mewsService.addCustomer(hotelId, args.email, args.firstName, args.lastName, guest.phone);
        pmsId = res.Id;
      } catch (err) {
        if (err.message && err.message.includes("already exists")) {
          // Fetch existing customer from Mews
          const existing = await mewsService.getGuestProfile(hotelId, args.email);
          if (existing && existing.Customers && existing.Customers.length > 0) {
            pmsId = existing.Customers[0].Id;
          } else {
            throw new Error("Customer exists in PMS but could not retrieve ID.");
          }
        } else {
          throw err;
        }
      }
      
      // Update local guest
      await prisma.guest.update({
        where: { id: guest.id },
        data: { 
          name: `${args.firstName} ${args.lastName}`,
          email: args.email,
          pmsGuestId: pmsId
        }
      });
      // also update the in-memory guest object so subsequent tools in the same conversation work
      guest.pmsGuestId = pmsId;
      guest.name = `${args.firstName} ${args.lastName}`;
      guest.email = args.email;
      
      return { status: "success", data: `Profile linked with PMS ID ${pmsId}. You can now book rooms.` };
    });
  }

  async _toolUpdateGuestProfile(hotelId, guest, args, context) {
    return this._withIdempotency(context.toolCallId, context.conversationId, hotelId, guest.id, "update_guest_profile", args, async () => {
       if (!guest.pmsGuestId) throw new Error("No PMS profile to update.");
       // Ownership implicitly valid if updating self
       return { status: "success", data: await mewsService.updateGuestNotes(hotelId, guest.pmsGuestId, args.notes || args.email) };
    });
  }

  async _toolUpdateGuestNotes(hotelId, guest, args, context) {
    return this._withIdempotency(context.toolCallId, context.conversationId, hotelId, guest.id, "update_guest_notes", args, async () => {
       if (!guest.pmsGuestId) throw new Error("No PMS profile.");
       return { status: "success", data: await mewsService.updateGuestNotes(hotelId, guest.pmsGuestId, args.notes) };
    });
  }

  async _toolCheckRoomAvailability(hotelId, guest, args, context) {
    // Read only, no idempotency needed
    const result = await mewsService.getRoomAvailability(hotelId, args.startDate, args.endDate);
    return { status: "success", data: result };
  }

  async _toolQuotePrice(hotelId, guest, args, context) {
    const result = await mewsService.getRoomAvailability(hotelId, args.startDate, args.endDate);
    return { status: "success", data: result };
  }

  async _toolCheckRatePlan(hotelId, guest, args, context) {
    return { status: "success", data: "Rate plan retrieved." }; // Simplified for now
  }

  async _toolGetAvailableServices(hotelId, guest, args, context) {
    const response = await mewsService.getServices(hotelId);
    const services = (response.Services || [])
       .filter(s => s.IsActive && s.Type === 'Reservable')
       .map(s => ({
          id: s.Id,
          name: s.Name,
          type: s.Type
       }));
    return { status: "success", data: services };
  }

  async _toolFindReservation(hotelId, guest, args, context) {
    if (!guest.pmsGuestId) return { status: "error", message: "Not linked." };
    const stays = await mewsService.getStayDetails(hotelId, guest.pmsGuestId);
    return { status: "success", data: stays };
  }

  async _toolGetReservationByCustomer(hotelId, guest, args, context) {
    return this._toolFindReservation(hotelId, guest, args, context);
  }

  async _toolGetCancellationPolicy(hotelId, guest, args, context) {
    return { status: "success", data: "Cancellation is allowed 24 hours prior." };
  }

  async _toolCreateReservation(hotelId, guest, args, context) {
    if (!global.activeBookingGuests) {
      global.activeBookingGuests = new Set();
    }
    if (global.activeBookingGuests.has(guest.id)) {
      throw new Error("A booking request is already in progress for this guest. Please wait.");
    }
    global.activeBookingGuests.add(guest.id);

    try {
      return await this._withIdempotency(context.toolCallId, context.conversationId, hotelId, guest.id, "create_reservation", args, async () => {
        if (!guest.pmsGuestId) throw new Error("Guest not in PMS.");

        // Check availability: count existing reservations in that window
        const window = await mewsService.getArrivalsDepartures(hotelId, args.startDate, args.endDate);
        const busyCount = (window.Reservations || []).length;
        console.log(`[Availability] ${busyCount} existing reservations in requested window.`);

        try {
          await prisma.bookingLock.create({
            data: { hotelId, serviceId: args.serviceId, startDate: new Date(args.startDate), endDate: new Date(args.endDate), expiresAt: new Date(Date.now() + 60000) }
          });
        } catch (e) {
          throw new Error("Race condition prevented: Inventory currently locked by another process.");
        }

        const bookingState = await prisma.bookingState.findUnique({ where: { conversationId: context.conversationId } });
        let rateId = null;
        if (bookingState) {
          rateId = bookingState.selectedRateId;
          if (bookingState.checkInDate && bookingState.checkOutDate) {
            const bsStart = bookingState.checkInDate.toISOString().substring(0, 10);
            const bsEnd = bookingState.checkOutDate.toISOString().substring(0, 10);
            const reqStart = new Date(args.startDate).toISOString().substring(0, 10);
            const reqEnd = new Date(args.endDate).toISOString().substring(0, 10);
            
            if (bsStart !== reqStart || bsEnd !== reqEnd) {
               throw new Error("Date mismatch detected. The requested booking dates do not match the active session booking dates. Please confirm your dates.");
            }
          }
        }

        try {
          // Use createRoomReservation which auto-fetches the RateId from Mews or uses the selected one
          const res = await mewsService.createRoomReservation(hotelId, guest.pmsGuestId, args.serviceId, args.startDate, args.endDate, rateId);
          
          await prisma.activityLog.create({ data: { conversationId: context.conversationId, actionType: "BOOKING_CREATED", actionDetails: JSON.stringify(res) } });
          await prisma.bookingLock.deleteMany({ where: { hotelId, serviceId: args.serviceId, startDate: new Date(args.startDate), endDate: new Date(args.endDate) } });
          
          const reservation = (res.Reservations || [])[0];
          if (!reservation) throw new Error('Booking created but no reservation data returned.');
          
          return { 
            status: "success", 
            data: {
              reservationId: reservation.Id,
              bookingNumber: reservation.Number,
              state: reservation.State,
              checkIn: reservation.StartUtc,
              checkOut: reservation.EndUtc,
              guestName: guest.name || 'John Doe'
            }
          };
        } catch (e) {
          await prisma.activityLog.create({ data: { conversationId: context.conversationId, actionType: "BOOKING_FAILED", actionDetails: e.message } });
          await prisma.bookingLock.deleteMany({ where: { hotelId, serviceId: args.serviceId, startDate: new Date(args.startDate), endDate: new Date(args.endDate) } });
          throw e;
        }
      });
    } finally {
      global.activeBookingGuests.delete(guest.id);
    }
  }

  async _toolModifyReservation(hotelId, guest, args, context) {
    return this._withIdempotency(context.toolCallId, context.conversationId, hotelId, guest.id, "modify_reservation", args, async () => {
      await this._ownershipMiddleware(hotelId, guest, args.reservationId);
      const res = await mewsService.updateReservation(hotelId, args.reservationId, { EndUtc: args.endUtc });
      return { status: "success", data: res };
    });
  }

  async _toolCancelReservation(hotelId, guest, args, context) {
    return this._withIdempotency(context.toolCallId, context.conversationId, hotelId, guest.id, "cancel_reservation", args, async () => {
      await this._ownershipMiddleware(hotelId, guest, args.reservationId);
      // Assuming mewsService.cancelReservation exists
      if (typeof mewsService.cancelReservation === 'function') {
         const res = await mewsService.cancelReservation(hotelId, args.reservationId, args.reason);
         return { status: "success", data: res };
      }
      return { status: "error", message: "mewsService.cancelReservation not implemented." };
    });
  }
  async _toolEscalateToHuman(hotelId, guest, args, context) {
    return this._withIdempotency(context.toolCallId, context.conversationId, hotelId, guest.id, "escalate_to_human", args, async () => {
      await conversationService.escalateConversation(context.conversationId, args.reason);
      return { _escalated: true };
    });
  }

  async _toolCreateServiceReservation(hotelId, guest, args, context) {
    return this._toolCreateReservation(hotelId, guest, args, context);
  }

  async _toolCheckInGuest(hotelId, guest, args, context) {
    return this._withIdempotency(context.toolCallId, context.conversationId, hotelId, guest.id, "check_in_guest", args, async () => {
      await this._ownershipMiddleware(hotelId, guest, args.reservationId);
      const res = await mewsService.updateReservation(hotelId, args.reservationId, { State: "CheckedIn" });
      return { status: "success", data: res };
    });
  }

  async _toolCheckOutGuest(hotelId, guest, args, context) {
    return this._withIdempotency(context.toolCallId, context.conversationId, hotelId, guest.id, "check_out_guest", args, async () => {
      await this._ownershipMiddleware(hotelId, guest, args.reservationId);
      const res = await mewsService.updateReservation(hotelId, args.reservationId, { State: "CheckedOut" });
      return { status: "success", data: res };
    });
  }

  async _toolCheckLateCheckout(hotelId, guest, args, context) {
    if (!guest.pmsGuestId) return { status: "error", message: "Not linked." };
    const stays = await mewsService.getStayDetails(hotelId, guest.pmsGuestId);
    const activeStay = stays.Reservations?.find(r => r.State === 'CheckedIn');
    if (!activeStay) return { status: "success", data: "Guest has no active CheckedIn reservation right now." };
    return { status: "success", data: { reservationId: activeStay.Id, message: "Late checkout is possible." } };
  }

  async _toolConfirmLateCheckout(hotelId, guest, args, context) {
    return this._withIdempotency(context.toolCallId, context.conversationId, hotelId, guest.id, "confirm_late_checkout", args, async () => {
      const stays = await mewsService.getStayDetails(hotelId, guest.pmsGuestId);
      const activeStay = stays.Reservations?.find(r => r.State === 'CheckedIn');
      if (!activeStay) throw new Error("Guest has no active CheckedIn reservation.");
      
      const res = await mewsService.updateReservation(hotelId, activeStay.Id, { EndUtc: args.time });
      return { status: "success", data: res };
    });
  }

  async _toolGetFolioBalance(hotelId, guest, args, context) {
    if (!guest.pmsGuestId) return { status: "error", message: "Not linked." };
    // Assuming mewsService.getFolioBalance exists
    if (typeof mewsService.getFolioBalance === 'function') {
      const res = await mewsService.getFolioBalance(hotelId, guest.pmsGuestId);
      return { status: "success", data: res };
    }
    return { status: "error", message: "mewsService.getFolioBalance not implemented." };
  }

  async _toolSendPaymentLink(hotelId, guest, args, context) {
    return this._withIdempotency(context.toolCallId, context.conversationId, hotelId, guest.id, "send_payment_link", args, async () => {
      if (!guest.pmsGuestId) throw new Error("Guest not in PMS.");
      
      // Folio Consistency Verifier
      if (typeof mewsService.getFolioBalance === 'function') {
         const currentFolio = await mewsService.getFolioBalance(hotelId, guest.pmsGuestId);
         const items = currentFolio.Items || [];
         const currentTotal = items.reduce((acc, curr) => acc + (curr.Amount?.Value || 0), 0);
         
         if (Math.abs(currentTotal - args.amount) > 0.01) {
            await prisma.activityLog.create({ data: { conversationId: context.conversationId, actionType: "PAYMENT_DESYNC_DETECTED", actionDetails: `Drift: ${currentTotal} vs requested ${args.amount}` } });
            throw new Error("FAILED_DUE_TO_DRIFT: Balance has changed. Re-fetch folio.");
         }
      }

      const settings = await prisma.hotelSettings.findUnique({ where: { hotelId } });
      const currency = settings ? settings.currencyCode : "USD";
      
      const res = await mewsService.sendPaymentLink(hotelId, guest.pmsGuestId, args.amount, currency);
      await prisma.activityLog.create({ data: { conversationId: context.conversationId, actionType: "PAYMENT_REQUEST_CREATED", actionDetails: JSON.stringify(res) } });
      return { status: "success", data: res };
    });
  }

  async _toolAmendPayment(hotelId, guest, args, context) {
    return this._withIdempotency(context.toolCallId, context.conversationId, hotelId, guest.id, "amend_payment", args, async () => {
      return { status: "error", message: "mewsService.amendPayment not implemented." };
    });
  }
  async _toolPostCharge(hotelId, guest, args, context) {
    return this._withIdempotency(context.toolCallId, context.conversationId, hotelId, guest.id, "post_charge", args, async () => {
      if (!guest.pmsGuestId) throw new Error("Guest not in PMS.");
      const settings = await prisma.hotelSettings.findUnique({ where: { hotelId } });
      const currency = settings ? settings.currencyCode : "USD";
      
      const res = await mewsService.postCharge(hotelId, guest.pmsGuestId, args.amount, currency, args.serviceId);
      return { status: "success", data: res };
    });
  }

  async _toolUpdateBookingState(hotelId, guest, args, context) {
    const updateData = {};
    if (args.checkInDate) updateData.checkInDate = new Date(args.checkInDate);
    if (args.checkOutDate) updateData.checkOutDate = new Date(args.checkOutDate);
    if (args.adults !== undefined) updateData.adults = args.adults;
    if (args.children !== undefined) updateData.children = args.children;
    if (args.roomType !== undefined) updateData.roomType = args.roomType;
    if (args.selectedRoomId !== undefined) updateData.selectedRoomId = args.selectedRoomId;
    if (args.selectedRateId !== undefined) updateData.selectedRateId = args.selectedRateId;

    const bs = await prisma.bookingState.upsert({
      where: { conversationId: context.conversationId },
      update: updateData,
      create: { conversationId: context.conversationId, ...updateData }
    });

    return { status: "success", data: bs };
  }
}

module.exports = new AutomationEngine();
