const automationEngine = require('./src/services/AutomationEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const hotelId = 13; // The Grand AutoPilot Resort (Mews connected)
  const senderIdentity = "+49123456789";
  const messageContent = "Hi! What is your checkout policy?";

  console.log(`=======================================================`);
  console.log(`🎬 RUNNING SCENARIO 1: Guest asks about checkout policy`);
  console.log(`Guest Phone: ${senderIdentity}`);
  console.log(`Message: "${messageContent}"`);
  console.log(`=======================================================`);

  try {
    const result = await automationEngine.handleIncomingMessage(hotelId, senderIdentity, messageContent, 'WhatsApp');
    console.log(`\n🤖 AI ANSWER DISPATCHED TO GUEST:`);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Scenario failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
