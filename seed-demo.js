const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding demo data...');

  // 1. Create a Hotel
  const hotel = await prisma.hotel.create({
    data: {
      hotelName: 'API Hotel Gross Pricing',
      pmsProvider: 'Mews',
      totalRooms: 150,
      pmsConnected: true,
      whatsappConnected: true,
      emailConnected: true,
      chatsToday: 12,
      aiProcessed: 10,
      satisfaction: 98.5
    }
  });

  // 2. Create some Guests
  const guest1 = await prisma.guest.create({
    data: {
      name: 'Sarah Jenkins',
      phone: '+49123456789',
      email: 'sarah@example.com',
      roomNumber: '502',
      pmsGuestId: 'mews-guest-1'
    }
  });

  const guest2 = await prisma.guest.create({
    data: {
      name: 'Michael Chen',
      phone: '+49987654321',
      email: 'michael@example.com',
      roomNumber: '112',
      pmsGuestId: 'mews-guest-2'
    }
  });

  // 3. Create a Conversation and Messages
  const conv1 = await prisma.conversation.create({
    data: {
      guestId: guest1.id,
      status: 'active',
      lastMessage: 'Late checkout approved'
    }
  });

  await prisma.message.createMany({
    data: [
      { conversationId: conv1.id, senderType: 'guest', content: 'Can I have a late checkout?', channel: 'WhatsApp' },
      { conversationId: conv1.id, senderType: 'ai', content: 'Sure, I have approved your late checkout until 2 PM.', channel: 'WhatsApp' }
    ]
  });

  // 4. Log Activity
  await prisma.activityLog.create({
    data: {
      conversationId: conv1.id,
      actionType: 'AI Response',
      actionDetails: 'Late checkout approved for Room 502'
    }
  });

  console.log('Seed completed!');
}

seed()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
