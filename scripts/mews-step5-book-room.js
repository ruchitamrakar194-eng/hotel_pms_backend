/**
 * STEP 5 — Book a Room for John Doe in Mews
 * Run: node scripts/mews-step5-book-room.js
 *
 * Uses John Doe's real Mews PMS ID and the "Overnight" service with the
 * best available rate. Everything is fetched live — zero hardcoded IDs.
 */
const mewsService = require('../src/services/mewsService.js');

const HOTEL_ID = 13;
const JOHN_EMAIL = 'john@example.com';

// Tomorrow check-in at 3pm, day after at 11am
const CHECK_IN  = new Date(Date.now() + 1 * 86400000);
CHECK_IN.setUTCHours(15, 0, 0, 0);
const CHECK_OUT = new Date(Date.now() + 2 * 86400000);
CHECK_OUT.setUTCHours(11, 0, 0, 0);

async function run() {
  console.log('\n🏨 Starting Room Booking for John Doe...');
  console.log('─'.repeat(50));

  // ── 1. Get John Doe's PMS ID ──────────────────────────
  console.log('\n[1/4] Looking up John Doe in Mews...');
  const guestResult = await mewsService.getGuestProfile(HOTEL_ID, JOHN_EMAIL);
  const guest = (guestResult.Customers || [])[0];
  if (!guest) {
    console.log('❌  John Doe not found in Mews. Run Step 1 first to confirm the profile exists.');
    return;
  }
  console.log(`  ✅ Found: ${guest.FirstName} ${guest.LastName} [PMS ID: ${guest.Id}]`);

  // ── 2. Get a Reservable room service ─────────────────
  console.log('\n[2/4] Fetching room services from Mews...');
  const servicesResult = await mewsService.getServices(HOTEL_ID);
  const rooms = (servicesResult.Services || []).filter(s => s.IsActive && s.Type === 'Reservable');
  if (rooms.length === 0) {
    console.log('❌  No active room services found.');
    return;
  }
  // Prefer "Overnight" service if it exists, otherwise use first
  const roomService = rooms.find(s => s.Name === 'Overnight') || rooms[0];
  console.log(`  ✅ Using room service: "${roomService.Name}" [${roomService.Id}]`);

  // ── 3. Get the best rate for this service ─────────────
  console.log('\n[3/4] Fetching rate plans...');
  const ratesResult = await mewsService.getRates(HOTEL_ID, roomService.Id);
  const rates = ratesResult.Rates || [];
  if (rates.length === 0) {
    console.log('❌  No rate plans found for this room service.');
    return;
  }
  const bestRate = rates.find(r => r.Name === 'Fully Flexible') || rates.find(r => r.Name === 'No-Flex') || rates[0];
  console.log(`  ✅ Using rate: "${bestRate.Name}" [${bestRate.Id}]`);

  // ── 4. Create the reservation ────────────────────────
  console.log('\n[4/4] Creating reservation in Mews...');
  console.log(`  Guest    : ${guest.FirstName} ${guest.LastName}`);
  console.log(`  Room     : ${roomService.Name}`);
  console.log(`  Rate     : ${bestRate.Name}`);
  console.log(`  Check-in : ${CHECK_IN.toISOString()}`);
  console.log(`  Check-out: ${CHECK_OUT.toISOString()}`);

  const bookingResult = await mewsService._request(HOTEL_ID, '/reservations/add', {
    Reservations: [{
      CustomerId: guest.Id,
      ServiceId: roomService.Id,
      RateId: bestRate.Id,
      StartUtc: CHECK_IN.toISOString(),
      EndUtc: CHECK_OUT.toISOString()
    }]
  });

  const created = (bookingResult.Reservations || [])[0];
  if (!created) {
    console.log('\n❌  Booking response was empty. Check the backend terminal for details.');
    console.log('    Raw response:', JSON.stringify(bookingResult));
    return;
  }

  console.log('\n🎉  BOOKING CONFIRMED!\n');
  console.log('  Reservation ID :', created.Id);
  console.log('  Booking Number :', created.Number);
  console.log('  State          :', created.State);
  console.log('  Check-in       :', created.StartUtc);
  console.log('  Check-out      :', created.EndUtc);
  console.log('  Guest          :', guest.FirstName, guest.LastName);
  console.log('  Room Service   :', roomService.Name);
  console.log('  Rate Plan      :', bestRate.Name);
  console.log('\n  ✅ John Doe is booked! This reservation now appears live in Mews Commander.');
}

run().catch(e => {
  console.error('\n❌ Error:', e.message);
});
