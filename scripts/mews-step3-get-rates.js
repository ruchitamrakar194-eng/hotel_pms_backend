/**
 * STEP 3 — Get Rate Plans for the room service
 * Run: node scripts/mews-step3-get-rates.js
 *
 * Paste the Service ID from Step 2 below:
 */
const mewsService = require('../src/services/mewsService.js');

const HOTEL_ID = 13;
// 👇 Paste any Service ID from Step 2 here (this is "Overnight" — change if you want a different room)
const SERVICE_ID = '12b0e869-d697-4f59-8fe0-b38b00ea83fd';

async function run() {
  console.log('\n💰 Fetching rate plans for service:', SERVICE_ID);
  console.log('─'.repeat(50));

  const result = await mewsService.getRates(HOTEL_ID, SERVICE_ID);
  const rates = result.Rates || [];

  if (rates.length === 0) {
    console.log('❌  No rates configured for this service.');
    console.log('   Try a different Service ID from Step 2.');
    return;
  }

  console.log(`✅  Found ${rates.length} rate plans!\n`);
  console.log('💳  AVAILABLE RATE PLANS:');
  console.log('─'.repeat(50));
  rates.forEach((r, i) => {
    console.log(`  ${i + 1}. "${r.Name}"`);
    console.log(`     Rate ID: ${r.Id}`);
    console.log(`     Active : ${r.IsActive}`);
  });

  const best = rates.find(r => r.Name === 'Fully Flexible') || rates.find(r => r.Name === 'No-Flex') || rates[0];
  console.log('\n⭐  RECOMMENDED RATE:', `"${best.Name}"`);
  console.log('   Rate ID:', best.Id);
  console.log('\n👉 Copy the Rate ID above — you will need it in Step 5 (booking).');
}

run().catch(console.error);
