/**
 * TEST 4: Low AI Confidence / Request for Human Handoff
 * Tests: Triggering human handoff when guest explicitly requests a human agent or asks a complex, unresolvable query.
 * Expected: AI recognizes it cannot resolve this autonomously and calls escalate_to_human.
 */
const automationEngine = require('./src/services/AutomationEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const hotelId = 13;
  const phone = "+491122334466"; // Guest asking complex/unusual question
  const message = "I want to bring my pet alligator. Your policy only talks about dogs. Can you make a special exception for me or transfer me to a human agent immediately?";

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 TEST 4: Low AI Confidence / Explicit Human Handoff Request`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Guest: ${phone}`);
  console.log(`Message: "${message}"\n`);
  console.log(`📋 EXPECTED:`);
  console.log(`  ✅ AI queries RAG, finds no policy for alligator exceptions`);
  console.log(`  ✅ AI detects low confidence in handling this exception`);
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
