const mewsService = require('../src/services/mewsService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const res = await mewsService.getServices(13);
    console.log('Services:', JSON.stringify(res.Services.map(s => ({ id: s.Id, name: s.Name, type: s.Type, isActive: s.IsActive })), null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
run();
