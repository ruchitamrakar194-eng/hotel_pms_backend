const automationEngine = require('./src/services/AutomationEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const hotelId = 13;
  const senderIdentity = "+49123456789"; // Sarah - existing guest
  const messageContent = "I need to cancel my reservation. My plans have changed and I cannot come anymore.";

  console.log(`=======================================================`);
  console.log(`🎬 RUNNING SCENARIO 6: Guest cancels their reservation`);
  console.log(`Guest Phone: ${senderIdentity}`);
  console.log(`Message: "${messageContent}"`);
  console.log(`=======================================================`);
  console.log(`\n📋 WHAT TO EXPECT:`);
  console.log(`  1. AI finds Sarah in local DB`);
  console.log(`  2. AI detects cancellation intent → Category B (Operations)`);
  console.log(`  3. AI calls: find_reservation → Mews /reservations/getAll`);
  console.log(`  4. AI calls: get_cancellation_policy → returns hotel policy`);
  console.log(`  5. AI calls: cancel_reservation → Mews /reservations/cancel`);
  console.log(`  6. Ownership middleware verifies reservation belongs to Sarah`);
  console.log(`  7. Idempotency prevents double cancellation`);
  console.log(`  8. AI replies with cancellation confirmation\n`);

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
