const automationEngine = require('./src/services/AutomationEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const hotelId = 13;
  const senderIdentity = "+49555888777"; // Brand new guest - not in DB or Mews
  const messageContent = "Hi, I would like to book a room for June 15 to June 17, 2026. My name is Ali Hassan and my email is ali.hassan@gmail.com";

  console.log(`=======================================================`);
  console.log(`🎬 RUNNING SCENARIO 3: Full booking flow (create profile + book room)`);
  console.log(`Guest Phone: ${senderIdentity}`);
  console.log(`Message: "${messageContent}"`);
  console.log(`=======================================================`);
  console.log(`\n📋 WHAT TO EXPECT:`);
  console.log(`  1. Unknown guest → created in local DB`);
  console.log(`  2. AI detects booking intent → Category B (Operations)`);
  console.log(`  3. AI calls: create_guest_profile (adds to Mews /customers/add)`);
  console.log(`  4. AI calls: get_available_services to find room service IDs`);
  console.log(`  5. AI calls: create_reservation (hits Mews /reservations/add)`);
  console.log(`  6. BookingLock prevents race conditions`);
  console.log(`  7. Idempotency engine records transaction in DB`);
  console.log(`  8. AI replies with booking confirmation details\n`);

  try {
    const result = await automationEngine.handleIncomingMessage(hotelId, senderIdentity, messageContent, 'WhatsApp');
    console.log(`\n🤖 FINAL AI RESULT:`);
    console.log(JSON.stringify(result, null, 2));

    // Show what was saved in DB
    const guest = await prisma.guest.findFirst({ where: { phone: senderIdentity } });
    if (guest) {
      console.log(`\n📁 GUEST SAVED IN LOCAL DB:`);
      console.log(`  Name: ${guest.name}`);
      console.log(`  Phone: ${guest.phone}`);
      console.log(`  Email: ${guest.email}`);
      console.log(`  PMS Guest ID (Mews): ${guest.pmsGuestId}`);
    }
  } catch (err) {
    console.error('Scenario failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
