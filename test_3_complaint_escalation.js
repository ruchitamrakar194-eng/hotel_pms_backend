/**
 * TEST 3: Guest makes a noise or smoking complaint
 * Tests: Policy-driven Human Escalation
 * Expected: AI recognizes complaint/violation policy (which demands escalation) and hands off to human.
 */
const automationEngine = require('./src/services/AutomationEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const hotelId = 13;
  const phone = "+49999888777"; // Guest reporting issue
  const message = "The guest in the next room is smoking on their balcony and the smoke is coming into my room. Also they are playing extremely loud music.";

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 TEST 3: Guest Complaint Escalation (No AI auto-reply, transfers to human)`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Guest: ${phone}`);
  console.log(`Message: "${message}"\n`);
  console.log(`📋 EXPECTED:`);
  console.log(`  ✅ AI identifies complaint that requires human intervention`);
  console.log(`  ✅ AI calls escalate_to_human`);
  console.log(`  ✅ Conversation status is set to "escalated"`);
  console.log(`  ✅ Returns automated=false indicating handoff to human\n`);

  try {
    const result = await automationEngine.handleIncomingMessage(hotelId, phone, message, 'WhatsApp');
    console.log(`\n🤖 AI RESPONSE/RESULT:`);
    console.log(JSON.stringify(result, null, 2));

    // Verify conversation status in DB
    const guest = await prisma.guest.findFirst({ where: { phone } });
    if (guest) {
      const conv = await prisma.conversation.findFirst({ where: { guestId: guest.id } });
      if (conv) {
        console.log(`\n📁 CONVERSATION STATUS IN DATABASE: "${conv.status}" (expected: escalated)`);
      }
    }
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();
