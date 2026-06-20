const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const { OpenAI } = require('openai');
const vectorDb = require('../src/utils/vectorDb');

const prisma = new PrismaClient();
const BACKEND_URL = 'http://localhost:5000';
const HOTEL_ID = 13;
const PHONE_NUMBER_ID = "1122308060957206"; // Matches the phone number ID in the user's DB
const DUMMY_APP_SECRET = 'test_secret_for_mock';
const GUEST_PHONE = "+15550100200";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Sleep helper
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to sign payload for the webhook signature check
function getSignature(payloadStr) {
  return 'sha256=' + crypto.createHmac('sha256', DUMMY_APP_SECRET).update(payloadStr).digest('hex');
}

// Send simulated WhatsApp webhook message
async function sendWhatsAppMessage(text) {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry_" + Date.now(),
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15550123456",
                phone_number_id: PHONE_NUMBER_ID
              },
              messages: [
                {
                  from: GUEST_PHONE,
                  id: "wamid.MOCK_" + Math.random().toString(36).substring(7),
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: {
                    body: text
                  },
                  type: "text"
                }
              ]
            },
            field: "messages"
          }
        ]
      }
    ]
  };

  const payloadStr = JSON.stringify(payload);
  const sig = getSignature(payloadStr);

  const res = await fetch(`${BACKEND_URL}/api/webhooks/whatsapp/${HOTEL_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': sig
    },
    body: payloadStr
  });

  if (res.status !== 200) {
    const errText = await res.text();
    throw new Error(`Webhook failed with status ${res.status}: ${errText}`);
  }
}

// Fetch the current conversation & messages for our guest
async function getConversationState() {
  // Find guest in local DB
  const guest = await prisma.guest.findFirst({
    where: { phone: GUEST_PHONE }
  });
  if (!guest) return null;

  const conversation = await prisma.conversation.findFirst({
    where: { guestId: guest.id },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  return { guest, conversation };
}

// Robust helper to wait for the final text response from the AI
async function waitForAIResponse(lastMessageCount) {
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const state = await getConversationState();
    if (state && state.conversation) {
      const messages = state.conversation.messages;
      
      // If escalated, we can stop waiting immediately
      if (state.conversation.status === 'escalated') {
        return messages.length;
      }

      // Check if new messages have been added
      if (messages.length > lastMessageCount) {
        const lastMsg = messages[messages.length - 1];
        // Ensure the last message is from AI and has non-empty text content
        if (lastMsg.senderType === 'ai' && lastMsg.content && lastMsg.content.trim().length > 0) {
          console.log(`🤖 AI Response: "${lastMsg.content}"`);
          return messages.length;
        }
      }
    }
  }
  throw new Error("Timeout waiting for AI response");
}

async function main() {
  console.log(`=======================================================`);
  console.log(`🧪 END-TO-END E2E TEST: JOHN DOE BOOKING & RAG FLOW (SEQUENTIAL)`);
  console.log(`=======================================================`);

  // 1. Setup Hotel 13 in DB
  console.log("\n1️⃣  Setting up Hotel 13 and WhatsApp configurations in DB...");
  const hotel = await prisma.hotel.upsert({
    where: { id: HOTEL_ID },
    update: {
      whatsappPhoneId: PHONE_NUMBER_ID,
      whatsappAppSecret: encrypt("test_secret_for_mock"), // App secret for signature checking
      pmsProvider: "Mews",
      whatsappConnected: true,
      pmsConnected: true
    },
    create: {
      id: HOTEL_ID,
      hotelName: "The Grand AutoPilot Resort",
      whatsappPhoneId: PHONE_NUMBER_ID,
      whatsappAppSecret: encrypt("test_secret_for_mock"),
      pmsProvider: "Mews",
      whatsappConnected: true,
      pmsConnected: true
    }
  });
  console.log(`✅ Hotel configured: "${hotel.hotelName}" (ID: ${hotel.id})`);

  // 2. Clear previous John Doe data to start clean
  console.log("\n2️⃣  Cleaning up any previous John Doe test data...");
  const oldGuest = await prisma.guest.findFirst({ where: { phone: GUEST_PHONE } });
  if (oldGuest) {
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
    await prisma.message.deleteMany({ where: { conversation: { guestId: oldGuest.id } } });
    await prisma.activityLog.deleteMany({ where: { conversation: { guestId: oldGuest.id } } });
    await prisma.conversation.deleteMany({ where: { guestId: oldGuest.id } });
    await prisma.guest.delete({ where: { id: oldGuest.id } });
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    console.log("✅ Cleaned up old records.");
  } else {
    console.log("✅ No old records found. Fresh slate.");
  }

  // 3. Seed RAG document text and generate Neon Vector Embeddings
  console.log("\n3️⃣  Vectorizing custom policy PDF content into Neon Vector DB...");
  const policyText = `The Grand AutoPilot Resort Rules & Policies:
- Free Wi-Fi is available in all rooms using the password 'autopilot2026'.
- Breakfast is served daily from 7:00 AM to 10:00 AM in the Ocean View Dining Room.
- Regular checkout is at 11:00 AM.
- Gold loyalty tier members are eligible for a complimentary late checkout until 2:00 PM (subject to availability).
- Pets are strictly not allowed in rooms or pool areas, except for certified service animals.`;

  // Check if document already exists to avoid duplicate pg entries
  await prisma.knowledgeDocument.deleteMany({ where: { filename: "Hotelogx_Sample_Hotel_Policies.pdf" } });
  
  // Create KnowledgeDocument db entry
  const doc = await prisma.knowledgeDocument.create({
    data: {
      hotelId: HOTEL_ID,
      filename: "Hotelogx_Sample_Hotel_Policies.pdf",
      fileUrl: "/uploads/mock_e2e_pdf.pdf",
      rawText: policyText,
      docType: "SOP",
      isVectorized: true,
      vectorCount: 1
    }
  });

  // Embed and save to Neon Vector DB
  const embResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: [policyText],
    dimensions: 1024
  });

  const records = [{
    id: `doc_${doc.id}_chunk_0`,
    documentId: doc.id,
    hotelId: HOTEL_ID,
    content: policyText,
    embedding: embResponse.data[0].embedding
  }];
  await vectorDb.upsertEmbeddings(records);
  console.log("✅ Custom policy successfully vectorized in Neon Vector DB.");

  let msgCount = 0;

  // 4. Send Message 1: Booking Intent
  console.log("\n4️⃣  Sending Message 1: Guest wants to book a room...");
  const msg1 = "Hi, I want to book a room from June 15 to June 17, 2026. My name is John Doe and my email is john.doe@gmail.com";
  console.log(`💬 John Doe → [WhatsApp]: "${msg1}"`);
  await sendWhatsAppMessage(msg1);

  console.log("⏳ Waiting for backend to fully process Message 1...");
  msgCount = await waitForAIResponse(msgCount);

  // 5. Send Message 2: RAG Query (from PDF)
  console.log("\n5️⃣  Sending Message 2: Asking question present in PDF policy...");
  const msg2 = "Awesome! What is the password for the Wi-Fi and what time is breakfast?";
  console.log(`💬 John Doe → [WhatsApp]: "${msg2}"`);
  await sendWhatsAppMessage(msg2);

  console.log("⏳ Waiting for backend to fully process Message 2...");
  msgCount = await waitForAIResponse(msgCount);

  // 6. Send Message 3: Escalation (Not in PDF)
  console.log("\n6️⃣  Sending Message 3: Demanding refund and speaking to manager (Should trigger Escalation)...");
  const msg3 = "I want a refund for my stay and I demand to talk to a manager immediately!";
  console.log(`💬 John Doe → [WhatsApp]: "${msg3}"`);
  await sendWhatsAppMessage(msg3);

  console.log("⏳ Waiting for backend to escalate to human...");
  msgCount = await waitForAIResponse(msgCount);

  // Final validation and outputting history
  const finalState = await getConversationState();
  if (finalState && finalState.conversation && finalState.conversation.status === 'escalated') {
    console.log(`\n🎉 SUCCESS! Conversation status changed to: "${finalState.conversation.status}"`);
    console.log("🤖 Conversation successfully transferred to a human operator.");
    
    console.log(`\n📋 CONVERSATION LOG HISTORY:`);
    finalState.conversation.messages.forEach(m => {
      // Print only user and AI text messages for readability
      if (m.senderType !== 'tool' && !(m.senderType === 'ai' && (!m.content || !m.content.trim()))) {
        console.log(`  [${m.senderType.toUpperCase()}] ${m.content}`);
      }
    });
  } else {
    console.log("❌ Escalation test failed or timed out.");
  }

  await prisma.$disconnect();
}

// Master encryption helper matching your cryptoUtils.js
function encrypt(text) {
  const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

main().catch(err => {
  console.error("Test script failed:", err);
  prisma.$disconnect();
});
