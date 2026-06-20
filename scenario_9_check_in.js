const automationEngine = require('./src/services/AutomationEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const hotelId = 13;
  const senderIdentity = "+49123456789"; // Sarah - existing guest
  const messageContent = "I have arrived at the hotel. Can you check me in please? My booking is under Sarah Nurjaya.";

  console.log(`=======================================================`);
  console.log(`🎬 RUNNING SCENARIO 9: Guest requests check-in`);
  console.log(`Guest Phone: ${senderIdentity}`);
  console.log(`Message: "${messageContent}"`);
  console.log(`=======================================================`);
  console.log(`\n📋 WHAT TO EXPECT:`);
  console.log(`  1. AI finds Sarah in local DB (existing guest)`);
  console.log(`  2. AI detects check-in intent → Category B (Operations)`);
  console.log(`  3. AI calls: find_reservation → Mews /reservations/getAll`);
  console.log(`     Returns Sarah's active reservation (State: Confirmed)`);
  console.log(`  4. AI calls: check_in_guest → Mews /reservations/update`);
  console.log(`     Ownership middleware verifies Sarah owns that reservation`);
  console.log(`  5. Idempotency prevents double check-in`);
  console.log(`  6. AI replies with welcome message + room details\n`);

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
