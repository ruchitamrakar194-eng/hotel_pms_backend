const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Connecting to database...');
    const hotels = await prisma.hotel.findMany();
    console.log('Successfully fetched hotels:');
    console.log(JSON.stringify(hotels, null, 2));
  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
