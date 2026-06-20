const mewsService = require('../src/services/mewsService.js');

// Suppress the verbose debug logs from mewsService for cleaner output
const originalLog = console.log;
console.log = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('========')) return;
  if (typeof args[0] === 'string' && args[0].includes('[MEWS API REQUEST]')) return;
  if (typeof args[0] === 'string' && args[0].includes('Payload:')) return;
  if (typeof args[0] === 'string' && args[0].includes('Response Status:')) return;
  if (typeof args[0] === 'string' && args[0].includes('Response Data:')) return;
  originalLog(...args);
};

const HOTEL_ID = 13;
const DIVIDER = '\n' + '='.repeat(60) + '\n';

async function run() {

  // ─────────────────────────────────────────────────────
  // TEST 1: getGuestProfile
  // ─────────────────────────────────────────────────────
  console.log(DIVIDER);
  console.log('TEST 1: getGuestProfile (by email)');
  console.log('─'.repeat(40));
  try {
    const result = await mewsService.getGuestProfile(HOTEL_ID, 'john@example.com');
    const guests = result.Customers || [];
    if (guests.length === 0) {
      console.log('❌  No guest found with that email.');
    } else {
      const g = guests[0];
      console.log('✅  Guest Found!');
      console.log(`    Name   : ${g.FirstName} ${g.LastName}`);
      console.log(`    Email  : ${g.Email}`);
      console.log(`    Phone  : ${g.Phone || 'N/A'}`);
      console.log(`    PMS ID : ${g.Id}`);
      console.log(`    Gender : ${g.Gender || 'N/A'}`);
    }
  } catch (e) {
    console.log('❌  Error:', e.message);
  }

  // ─────────────────────────────────────────────────────
  // TEST 2: addCustomer (create new guest)
  // ─────────────────────────────────────────────────────
  console.log(DIVIDER);
  console.log('TEST 2: addCustomer (create new guest)');
  console.log('─'.repeat(40));
  try {
    const ts = Date.now();
    const testEmail = `demo_guest_${ts}@test.com`;
    const result = await mewsService.addCustomer(HOTEL_ID, testEmail, 'Demo', 'Guest', '+923001234567');
    console.log('✅  Guest Created in Mews!');
    console.log(`    Name   : ${result.FirstName} ${result.LastName}`);
    console.log(`    Email  : ${result.Email}`);
    console.log(`    PMS ID : ${result.Id}`);
    console.log(`    Number : ${result.Number}`);
    console.log(`    Status : ${result.ActivityState}`);
  } catch (e) {
    console.log('❌  Error:', e.message);
  }

  // ─────────────────────────────────────────────────────
  // TEST 3: getServices (rooms + extras)
  // ─────────────────────────────────────────────────────
  console.log(DIVIDER);
  console.log('TEST 3: getServices (all active services)');
  console.log('─'.repeat(40));
  try {
    const result = await mewsService.getServices(HOTEL_ID);
    const all = result.Services || [];
    const active = all.filter(s => s.IsActive);
    const rooms = active.filter(s => s.Type === 'Reservable');
    const extras = active.filter(s => s.Type === 'Orderable');
    console.log('✅  Services Loaded!');
    console.log(`    Total services   : ${all.length}`);
    console.log(`    Active services  : ${active.length}`);
    console.log(`    Rooms (Reservable): ${rooms.length}`);
    console.log(`    Extras (Orderable): ${extras.length}`);
    console.log('\n    🏨 Room Services:');
    rooms.slice(0, 5).forEach(s => console.log(`      - "${s.Name}" [${s.Id}]`));
    console.log('\n    🍽️  Extra Services (first 5):');
    extras.slice(0, 5).forEach(s => console.log(`      - "${s.Name}" [${s.Id}]`));
  } catch (e) {
    console.log('❌  Error:', e.message);
  }

  // ─────────────────────────────────────────────────────
  // TEST 4: getRoomAvailability
  // ─────────────────────────────────────────────────────
  console.log(DIVIDER);
  console.log('TEST 4: getRoomAvailability (next 24 hours)');
  console.log('─'.repeat(40));
  try {
    const now = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const result = await mewsService.getRoomAvailability(HOTEL_ID, now, tomorrow);
    const blocks = result.ResourceBlocks || [];
    console.log('✅  Availability Fetched!');
    console.log(`    Rooms out-of-service/blocked: ${blocks.length}`);
    if (blocks.length > 0) {
      console.log('\n    🚫 Blocked Rooms:');
      blocks.forEach(b => {
        console.log(`      - [${b.Type}] "${b.Name}"`);
        console.log(`        From: ${b.StartUtc}  →  Until: ${b.EndUtc}`);
      });
    } else {
      console.log('    ✅  No rooms currently blocked!');
    }
  } catch (e) {
    console.log('❌  Error:', e.message);
  }

  // ─────────────────────────────────────────────────────
  // TEST 5: getArrivalsDepartures
  // ─────────────────────────────────────────────────────
  console.log(DIVIDER);
  console.log('TEST 5: getArrivalsDepartures (next 3 days)');
  console.log('─'.repeat(40));
  try {
    const now = new Date().toISOString();
    const plus3days = new Date(Date.now() + 86400000 * 3).toISOString();
    const result = await mewsService.getArrivalsDepartures(HOTEL_ID, now, plus3days);
    const reservations = result.Reservations || [];
    const customers = result.Customers || [];
    console.log('✅  Reservations Fetched!');
    console.log(`    Reservations in window : ${reservations.length}`);
    console.log(`    Guests in window       : ${customers.length}`);
    if (reservations.length > 0) {
      console.log('\n    📋 Latest 3 Reservations:');
      reservations.slice(0, 3).forEach(r => {
        console.log(`      - #${r.Number} | State: ${r.State} | ${r.StartUtc} → ${r.EndUtc}`);
      });
    }
    if (customers.length > 0) {
      console.log('\n    👥 Sample Guests:');
      customers.slice(0, 3).forEach(c => {
        console.log(`      - ${c.FirstName} ${c.LastName} (${c.Email || 'no email'})`);
      });
    }
  } catch (e) {
    console.log('❌  Error:', e.message);
  }

  console.log(DIVIDER);
  console.log('ALL TESTS COMPLETE ✅');
  console.log('='.repeat(60) + '\n');
}

run().catch(console.error);
