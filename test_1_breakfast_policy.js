/**
 * TEST 1: New guest asks about breakfast
 * Tests: PDF RAG → Breakfast policy answer (EUR 15/person, 07:00-10:30, kids under 6 free)
 * Expected: AI answers from Hotelogx_Sample_Hotel_Policies.pdf WITHOUT calling Mews
 */
const automationEngine = require('./src/services/AutomationEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const hotelId = 13;
  const phone = "+491122334455"; // Brand new guest
  const message = "Hello! Can you tell me about your breakfast? What time is it and how much does it cost?";

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 TEST 1: Breakfast Policy Question (Pure RAG from PDF)`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Guest: ${phone}`);
  console.log(`Message: "${message}"\n`);
  console.log(`📋 EXPECTED:`);
  console.log(`  ✅ AI reads from Hotelogx_Sample_Hotel_Policies.pdf`);
  console.log(`  ✅ Answers: EUR 15/person, 07:00-10:30, children under 6 free`);
  console.log(`  ❌ Should NOT call Mews (info-only question)\n`);

  try {
    const result = await automationEngine.handleIncomingMessage(hotelId, phone, message, 'WhatsApp');
    console.log(`\n🤖 AI RESPONSE:`);
    console.log(`"${result.response}"`);
    console.log(`\n📊 Result: automated=${result.automated}, success=${result.success}`);
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();
