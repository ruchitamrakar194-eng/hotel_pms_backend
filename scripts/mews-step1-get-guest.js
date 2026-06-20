/**
 * STEP 1 — Get John Doe's profile from Mews
 * Run: node scripts/mews-step1-get-guest.js
 */
const mewsService = require('../src/services/mewsService.js');

const HOTEL_ID = 13;
const JOHN_EMAIL = 'john@example.com';

async function run() {
  console.log('\n🔍 Fetching guest profile for:', JOHN_EMAIL);
  console.log('─'.repeat(50));

  const result = await mewsService.getGuestProfile(HOTEL_ID, JOHN_EMAIL);
  const guests = result.Customers || [];

  if (guests.length === 0) {
    console.log('❌  No guest found with email:', JOHN_EMAIL);
    return;
  }

  const g = guests[0];
  console.log('✅  GUEST FOUND IN MEWS!\n');
  console.log('  Full Name  :', g.FirstName, g.LastName);
  console.log('  Email      :', g.Email);
  console.log('  Phone      :', g.Phone || 'N/A');
  console.log('  Gender     :', g.Gender || 'N/A');
  console.log('  PMS ID     :', g.Id);   // <-- This is needed for booking
  console.log('  Mews No.   :', g.Number);
  console.log('  Status     :', g.ActivityState);
  console.log('\n👉 Copy the PMS ID above — you will need it in Step 5 (booking).');
}

run().catch(console.error);
