/**
 * STEP 4 — Check Room Availability (what rooms are free tomorrow)
 * Run: node scripts/mews-step4-check-availability.js
 */
const mewsService = require('../src/services/mewsService.js');

const HOTEL_ID = 13;

// Tomorrow check-in at 3pm, check-out day after at 11am (standard hotel times)
const CHECK_IN  = new Date(Date.now() + 1 * 86400000);
CHECK_IN.setUTCHours(15, 0, 0, 0);

const CHECK_OUT = new Date(Date.now() + 2 * 86400000);
CHECK_OUT.setUTCHours(11, 0, 0, 0);

async function run() {
  console.log('\n📅 Checking room availability for:');
  console.log('   Check-in :', CHECK_IN.toISOString());
  console.log('   Check-out:', CHECK_OUT.toISOString());
  console.log('─'.repeat(50));

  // Get blocked/out-of-order rooms
  const blocked = await mewsService.getRoomAvailability(HOTEL_ID, CHECK_IN.toISOString(), CHECK_OUT.toISOString());
  const blocks = blocked.ResourceBlocks || [];

  // Get all arrivals/departures to see who's checked in
  const arrivals = await mewsService.getArrivalsDepartures(HOTEL_ID, CHECK_IN.toISOString(), CHECK_OUT.toISOString());
  const reservations = arrivals.Reservations || [];
  const customers = arrivals.Customers || [];

  console.log('✅  AVAILABILITY REPORT\n');
  console.log('🚫  ROOMS OUT OF ORDER:', blocks.length);
  blocks.forEach(b => {
    console.log(`    - "${b.Name}" | Type: ${b.Type}`);
    console.log(`      Period: ${b.StartUtc} → ${b.EndUtc}`);
  });

  console.log('\n📋  EXISTING RESERVATIONS IN THIS PERIOD:', reservations.length);
  reservations.slice(0, 5).forEach(r => {
    console.log(`    - Reservation #${r.Number} | ${r.State} | ${r.StartUtc} → ${r.EndUtc}`);
  });
  if (reservations.length > 5) console.log(`    ... and ${reservations.length - 5} more.`);

  console.log('\n👥  GUESTS STAYING IN THIS PERIOD:', customers.length);
  customers.slice(0, 5).forEach(c => {
    console.log(`    - ${c.FirstName} ${c.LastName} (${c.Email || 'no email'})`);
  });

  console.log('\n👉 Room service is available. Proceed to Step 5 to book for John Doe!');
}

run().catch(console.error);
