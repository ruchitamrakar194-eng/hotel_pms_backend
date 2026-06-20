const automationEngine = require('./src/services/AutomationEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const hotelId = 13;
  const senderIdentity = "+49777888999"; // New guest
  const messageContent = "I was charged twice on my credit card for the same booking. This is unacceptable, I want a full refund immediately and I need to speak to a manager about this billing dispute.";

  console.log(`=======================================================`);
  console.log(`🎬 RUNNING SCENARIO 7: Angry guest complaint → Human escalation`);
  console.log(`Guest Phone: ${senderIdentity}`);
  console.log(`Message: "${messageContent}"`);
  console.log(`=======================================================`);
  console.log(`\n📋 WHAT TO EXPECT:`);
  console.log(`  1. New guest created in local DB`);
  console.log(`  2. AI detects complex dispute / refund intent`);
  console.log(`  3. AI determines this cannot be safely automated`);
  console.log(`  4. AI calls: escalate_to_human → conversation moved to Takeover Queue`);
  console.log(`  5. Conversation status updated to "escalated" in DB`);
  console.log(`  6. Human operator now sees this in TakeoverQueue page`);
  console.log(`  7. AI replies with professional holding message\n`);

  try {
    const result = await automationEngine.handleIncomingMessage(hotelId, senderIdentity, messageContent, 'WhatsApp');
    console.log(`\n🤖 FINAL AI RESULT (should be escalated=false):`);
    console.log(JSON.stringify(result, null, 2));

    // Verify escalation in DB
    const guest = await prisma.guest.findFirst({ where: { phone: senderIdentity } });
    if (guest) {
      const conv = await prisma.conversation.findFirst({ where: { guestId: guest.id } });
      if (conv) {
        console.log(`\n📁 CONVERSATION STATUS IN DB: ${conv.status}`);
        console.log(`(Should be "escalated" so human can see it in TakeoverQueue)`);
      }
    }
  } catch (err) {
    console.error('Scenario failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
