const automationEngine = require('../src/services/AutomationEngine');
const mewsService = require('../src/services/mewsService');
const guestService = require('../src/services/guestService');
const conversationService = require('../src/services/conversationService');

async function runBigChat() {
  console.log("==================================================================");
  console.log("🏨 STARTING BIG CHAT - BOOKING & ESCALATION TEST (REAL MEWS)");
  console.log("==================================================================\n");

  const hotelId = 13;
  const guestPhone = "+15559876543";

  // Pre-create guest so it's linked
  let guest = await guestService.findByIdentity(guestPhone);
  if (!guest) {
    guest = await guestService.createGuest({ name: 'Sarah Jenkins', phone: guestPhone, email: 'sarah@example.com', status: 'Gold Member' });
  }
  
  // Link to a real Mews Guest ID so the Live Demo API works
  await guestService.updateGuest(guest.id, { pmsGuestId: 'c785aa76-b530-465d-a657-b0eb00bbe8e8' });

  // Array of messages to simulate a real back-and-forth chat
  const chatSequence = [
    // 1. Force the AI to book a real accommodation service (using ID fetched from demo DB)
    "Hello! Can you book the Accommodation service (ID: bd26d8db-86da-4f96-9efc-e5a4654a4a94) for me? I want to stay from 2026-07-01 to 2026-07-05.",
    
    // 2. Throw an ambiguous curveball to force escalation
    "I am extremely angry about this booking! Do not reply to me with a bot message. I DEMAND you escalate this to a human manager immediately! This is an emergency!"
  ];

  for (let i = 0; i < chatSequence.length; i++) {
    const msg = chatSequence[i];
    console.log(`\n\x1b[36m👤 GUEST:\x1b[0m "${msg}"`);
    console.log(`\x1b[90m⚙️  AI is thinking & talking to Mews...\x1b[0m\n`);
    
    // Process the message via the real Automation Engine
    const result = await automationEngine.handleIncomingMessage(hotelId, guestPhone, msg, 'WhatsApp');
    
    if (result.action === 'escalate') {
       console.log(`\x1b[41m\x1b[37m 🚨 ESCALATED TO HUMAN 🚨 \x1b[0m`);
       console.log(`\x1b[31mReason:\x1b[0m ${result.reason || 'Requested human operator'}`);
    } else {
       console.log(`\x1b[32m🤖 AI RESPONSE:\x1b[0m ${result.response}`);
       if (result.tool && result.tool !== 'none') {
          console.log(`\x1b[33m🔧 TOOLS USED:\x1b[0m ${result.tool}`);
       }
    }
    
    // Simulate reading time
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log("\n==================================================================");
  console.log("✅ BOOKING & ESCALATION SIMULATION COMPLETE.");
  console.log("==================================================================\n");
  
  process.exit(0);
}

runBigChat();
