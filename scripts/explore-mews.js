const mewsService = require('../src/services/mewsService.js');

async function explore() {
  console.log('\n====================================');
  console.log('  MEWS DEMO API EXPLORATION REPORT');
  console.log('====================================\n');

  // ─── 1. Services ─────────────────────────────────────
  console.log('[1/5] Fetching Services (rooms + extras)...');
  const services = await mewsService.getServices(13);
  const activeServices = services.Services.filter(s => s.IsActive);
  const reservable = activeServices.filter(s => s.Type === 'Reservable');
  const orderable = activeServices.filter(s => s.Type === 'Orderable');
  console.log(`  Total services:    ${services.Services.length}`);
  console.log(`  Active services:   ${activeServices.length}`);
  console.log(`  Reservable (rooms): ${reservable.length}`);
  console.log(`  Orderable (extras): ${orderable.length}`);
  if (reservable.length > 0) {
    console.log(`  First Room Service: "${reservable[0].Name}" [${reservable[0].Id}]`);
  }

  // ─── 2. Rates for room service ─────────────────────────
  if (reservable.length > 0) {
    console.log('\n[2/5] Fetching Rate Plans for Room Service...');
    const rates = await mewsService.getRates(13, reservable[0].Id);
    console.log(`  Total rates found: ${rates.Rates ? rates.Rates.length : 0}`);
    if (rates.Rates && rates.Rates.length > 0) {
      rates.Rates.forEach(r => console.log(`  - "${r.Name}" [${r.Id}]`));
    } else {
      console.log('  ⚠️  No rates configured — this is why reservation creation fails!');
    }
  }

  // ─── 3. Arrivals today (max 3 days) ───────────────────
  console.log('\n[3/5] Fetching Arrivals in Next 3 Days...');
  const start = new Date().toISOString();
  const end = new Date(Date.now() + 86400000 * 3).toISOString(); // 3 days max (Mews limit: 100 hours)
  const arrivals = await mewsService.getArrivalsDepartures(13, start, end);
  const numRes = arrivals.Reservations ? arrivals.Reservations.length : 0;
  const numCust = arrivals.Customers ? arrivals.Customers.length : 0;
  console.log(`  Reservations in window: ${numRes}`);
  console.log(`  Customers in window:    ${numCust}`);
  if (arrivals.Customers && arrivals.Customers.length > 0) {
    const c = arrivals.Customers[0];
    console.log(`  First guest: ${c.FirstName} ${c.LastName} (${c.Email || 'no email'}) [${c.Id}]`);
  }

  // ─── 4. Room Availability Blocks ─────────────────────
  console.log('\n[4/5] Fetching Room Availability/Block Status for 24hrs...');
  const end24 = new Date(Date.now() + 86400000).toISOString();
  const avail = await mewsService.getRoomAvailability(13, start, end24);
  const blocks = avail.ResourceBlocks || [];
  console.log(`  Resource blocks (Out-of-Order, etc.): ${blocks.length}`);
  blocks.slice(0, 3).forEach(b => console.log(`  - [${b.Type}] "${b.Name}" (${b.StartUtc} → ${b.EndUtc})`));

  // ─── 5. Guest Profile Lookup ─────────────────────────
  console.log('\n[5/5] Fetching Guest Profile (john@example.com)...');
  const guest = await mewsService.getGuestProfile(13, 'john@example.com');
  const customers = guest.Customers || [];
  console.log(`  Customers found: ${customers.length}`);
  if (customers.length > 0) {
    const g = customers[0];
    console.log(`  Name:  ${g.FirstName} ${g.LastName}`);
    console.log(`  Email: ${g.Email}`);
    console.log(`  ID:    ${g.Id}`);
  }

  console.log('\n====================================');
  console.log('  EXPLORATION COMPLETE');
  console.log('====================================\n');
}

explore().catch(console.error);
