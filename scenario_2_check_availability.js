const automationEngine = require('./src/services/AutomationEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const hotelId = 13;
  const senderIdentity = "+491111222333"; // New unknown guest
  const messageContent = "Hello! I want to check if you have rooms available from June 10 to June 13, 2026?";

  console.log(`=======================================================`);
  console.log(`🎬 RUNNING SCENARIO 2: New guest checks room availability`);
  console.log(`Guest Phone: ${senderIdentity}`);
  console.log(`Message: "${messageContent}"`);
  console.log(`=======================================================`);
  console.log(`\n📋 WHAT TO EXPECT:`);
  console.log(`  1. AI will NOT find guest in local DB (new guest)`);
  console.log(`  2. AutomationEngine will try Mews profile lookup by phone`);
  console.log(`  3. If not found in Mews, creates "Unknown Guest" in local DB`);
  console.log(`  4. AI decides: Category B (Operations) -> calls get_available_services`);
  console.log(`  5. AI then calls check_room_availability with Mews API`);
  console.log(`  6. Mews returns resource blocks -> AI replies to guest\n`);

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
