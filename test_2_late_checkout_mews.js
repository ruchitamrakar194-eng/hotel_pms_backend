/**
 * TEST 2: Existing guest requests late checkout
 * Tests: PDF RAG + Mews Integration
 * Policy: Late check-out until 14:00 costs EUR 25. Late check-out until 17:00 costs EUR 50.
 * Expected: AI fetches reservation from Mews, tells guest about the price, updates checkout time and adds fee to folio.
 */
const automationEngine = require('./src/services/AutomationEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const hotelId = 13;
  // Sarah's phone (+49123456789) is linked to a customer in Mews
  const phone = "+49123456789"; 
  const message = "Hi, can I get a late checkout today? I'd like to leave at 2 PM instead of 11 AM.";

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 TEST 2: Late Checkout Request (RAG + Mews Integration)`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Guest: ${phone}`);
  console.log(`Message: "${message}"\n`);
  console.log(`📋 EXPECTED:`);
  console.log(`  ✅ AI finds guest's reservation in Mews`);
  console.log(`  ✅ AI consults PDF: Late checkout until 14:00 (2 PM) costs EUR 25`);
  console.log(`  ✅ AI calls Mews to update reservation and post the charge`);
  console.log(`  ✅ AI replies confirming late checkout at 2 PM with the EUR 25 fee\n`);

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
