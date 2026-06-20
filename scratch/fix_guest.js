const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const result = await prisma.guest.updateMany({
    where: { phone: '+49123456789' },
    data: { pmsGuestId: '43dbb9dd-34dc-4aba-9e86-b30c003ea948' }
  });
  console.log('Update result:', result);
}

fix()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
