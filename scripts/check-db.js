const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.conversation.findMany({ include: { guest: true, messages: true } }).then(c => {
  console.log(JSON.stringify(c, null, 2));
  prisma.$disconnect();
});
