require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.hotel.findUnique({where: {id: 13}})
  .then(h => console.log(h))
  .finally(() => prisma.$disconnect());
