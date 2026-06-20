const automationEngine = require('./src/services/AutomationEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const hotelId = 13;
  const senderIdentity = "+49123456789"; // Sarah - existing guest with pmsGuestId
  const messageContent = "Can you tell me how much I owe? I want to see my bill before checkout.";

  console.log(`=======================================================`);
  console.log(`🎬 RUNNING SCENARIO 5: Guest asks for their bill balance`);
  console.log(`Guest Phone: ${senderIdentity}`);
  console.log(`Message: "${messageContent}"`);
  console.log(`=======================================================`);
  console.log(`\n📋 WHAT TO EXPECT:`);
  console.log(`  1. AI finds Sarah in local DB`);
  console.log(`  2. AI detects billing intent → Category B (Operations)`);
  console.log(`  3. AI calls: get_folio_balance → Mews /finance/items/getAll`);
  console.log(`  4. Mews returns all unpaid charges on Sarah's folio`);
  console.log(`  5. AI summarizes outstanding amount and replies to guest\n`);

  try {
    const result = await automationEngine.handleIncomingMessage(hotelId, senderIdentity, messageContent, 'WhatsApp');
    console.log(`\n🤖 FINAL AI RESULT:`);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Scenario failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
