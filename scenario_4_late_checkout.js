const automationEngine = require('./src/services/AutomationEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const hotelId = 13;
  // sarah@example.com exists in Mews demo as Customer ID: 43dbb9dd-34dc-4aba-9e86-b30c003ea948
  const senderIdentity = "+49123456789"; // Sarah's phone (already in local DB from seed)
  const messageContent = "Hi, can I get a late checkout? I want to leave at 2 PM instead of 11 AM.";

  console.log(`=======================================================`);
  console.log(`🎬 RUNNING SCENARIO 4: Existing guest requests late checkout`);
  console.log(`Guest Phone: ${senderIdentity}`);
  console.log(`Message: "${messageContent}"`);
  console.log(`=======================================================`);
  console.log(`\n📋 WHAT TO EXPECT:`);
  console.log(`  1. AI finds Sarah in local DB (already seeded)`);
  console.log(`  2. AI detects late checkout intent → Category B (Operations)`);
  console.log(`  3. AI calls: check_late_checkout → Mews getStayDetails`);
  console.log(`  4. Mews returns active reservations for Sarah's pmsGuestId`);
  console.log(`  5. AI calls: confirm_late_checkout → Mews updateReservation`);
  console.log(`  6. AI replies confirming new checkout time\n`);

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
