/**
 * STEP 2 — Get all available Room Services from Mews
 * Run: node scripts/mews-step2-get-services.js
 */
const mewsService = require('../src/services/mewsService.js');

const HOTEL_ID = 13;

async function run() {
  console.log('\n🏨 Fetching available room services from Mews...');
  console.log('─'.repeat(50));

  const result = await mewsService.getServices(HOTEL_ID);
  const allServices = result.Services || [];

  // Only show Reservable (room) services that are active
  const rooms = allServices.filter(s => s.IsActive && s.Type === 'Reservable');
  const extras = allServices.filter(s => s.IsActive && s.Type === 'Orderable');

  console.log(`✅  Found ${allServices.length} total services (${rooms.length} rooms, ${extras.length} extras)\n`);

  console.log('🏨  BOOKABLE ROOM SERVICES:');
  console.log('─'.repeat(50));
  rooms.forEach((s, i) => {
    console.log(`  ${i + 1}. "${s.Name}"`);
    console.log(`     Service ID: ${s.Id}`);
  });

  console.log('\n🍽️   ORDERABLE EXTRAS (first 10):');
  console.log('─'.repeat(50));
  extras.slice(0, 10).forEach((s, i) => {
    console.log(`  ${i + 1}. "${s.Name}" [${s.Id}]`);
  });

  console.log('\n👉 Copy a Service ID from "BOOKABLE ROOM SERVICES" above.');
  console.log('   You will use it in Step 3 (get rates) and Step 5 (booking).');
}

run().catch(console.error);
