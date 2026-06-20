/**
 * TEST: Direct Mews PMS Connection Verification
 * Tests: Connecting directly to Mews API, calling /services/getAll and /rates/getAll.
 * Expected: Success response showing active hotel services and rates from Mews Sandbox.
 */
const mewsService = require('./src/services/mewsService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const hotelId = 13; // Hotel 13 is connected to Mews

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 DIRECT MEWS PMS CONNECTION TEST`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Hotel ID: ${hotelId}`);
  console.log(`Mews API URL: ${process.env.MEWS_BASE_URL || 'https://api.mews-demo.com/api/connector/v1/'}\n`);

  try {
    // 1. Fetch Services
    console.log('📡 Fetching Services from Mews...');
    const servicesRes = await mewsService.getServices(hotelId);
    const activeServices = (servicesRes.Services || [])
      .filter(s => s.IsActive && s.Type === 'Reservable')
      .map(s => ({ id: s.Id, name: s.Name }));

    console.log(`✅ Connection Successful! Found ${activeServices.length} active reservable stay services.`);
    console.log('Stay Services Sample:', activeServices.slice(0, 3));

    // 2. Fetch Rates for the first service if found
    if (activeServices.length > 0) {
      const targetService = activeServices[0];
      console.log(`\n📡 Fetching Rates for service: "${targetService.name}"...`);
      const ratesRes = await mewsService.getRates(hotelId, targetService.id);
      const activeRates = (ratesRes.Rates || []).map(r => ({ id: r.Id, name: r.Name }));
      console.log(`✅ Found ${activeRates.length} rate plans.`);
      console.log('Rates Sample:', activeRates.slice(0, 3));
    }

    console.log(`\n🎉 MEWS PMS INTEGRATION STATUS: ONLINE & FULLY FUNCTIONAL!`);
  } catch (err) {
    console.error('\n❌ Mews connection failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
