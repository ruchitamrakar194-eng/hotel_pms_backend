const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const hotelsData = [
    { name: 'The Grand AutoPilot Resort', pmsConnected: 'Opera PMS', whatsappActive: true, knowledgeBaseActive: true, chatsToday: 115, aiProcessed: 1240, satisfaction: 98.5, escalations: 4, plan: 'Enterprise', status: 'Active', monthlyUsage: 84 },
    { name: 'Boutique Ritz Paris', pmsConnected: 'Mews', whatsappActive: true, knowledgeBaseActive: true, chatsToday: 86, aiProcessed: 890, satisfaction: 97.2, escalations: 0, plan: 'Enterprise', status: 'Active', monthlyUsage: 68 },
    { name: 'Mews Haven Hotel', pmsConnected: 'Mews', whatsappActive: true, knowledgeBaseActive: true, chatsToday: 46, aiProcessed: 412, satisfaction: 99.0, escalations: 2, plan: 'Standard', status: 'Paused', monthlyUsage: 42 },
    { name: 'Apaleo Executive Suites', pmsConnected: 'Apaleo', whatsappActive: false, knowledgeBaseActive: true, chatsToday: 23, aiProcessed: 142, satisfaction: 94.8, escalations: 0, plan: 'Trial', status: 'Active', monthlyUsage: 18 }
  ];

  for (const hotel of hotelsData) {
    await prisma.hotel.create({
      data: hotel
    });
  }
  console.log('Seed completed!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
