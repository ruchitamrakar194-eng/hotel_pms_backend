/**
 * UI STEP 4 — John Doe books a room
 * Run: node scripts/ui-john-step4-book-room.js
 */
const http = require('http');
const crypto = require('crypto');

const HOTEL_ID = 13;
const JOHN_PHONE = '15559876543';
const MESSAGE = 'Great! Please book the Overnight room for me for tomorrow night. My name is John Doe, email is john@example.com';

const payload = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [{
    id: '1234567890',
    changes: [{
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '15550000000', phone_number_id: '1122308060957206' },
        contacts: [{ profile: { name: 'John Doe' }, wa_id: JOHN_PHONE }],
        messages: [{
          from: JOHN_PHONE,
          id: `wamid.ui_step4_${Date.now()}`,
          timestamp: Math.floor(Date.now() / 1000).toString(),
          text: { body: MESSAGE },
          type: 'text'
        }]
      },
      field: 'messages'
    }]
  }]
});

const SECRET = 'test_webhook_secret';
const sig = 'sha256=' + crypto.createHmac('sha256', SECRET).update(payload).digest('hex');

const options = {
  hostname: '127.0.0.1', port: 5000,
  path: `/api/webhooks/whatsapp/${HOTEL_ID}`,
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': sig, 'Content-Length': Buffer.byteLength(payload) }
};

console.log('\n📤 Sending as John Doe:', MESSAGE);
console.log('─'.repeat(55));

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log(`✅ Status: ${res.statusCode}`);
    console.log('👁️  Watch the UI! The AI will now:');
    console.log('     1. Find John Doe in Mews');
    console.log('     2. Fetch the Overnight room service');
    console.log('     3. Get the best rate plan');
    console.log('     4. Create the reservation in Mews');
    console.log('     5. Confirm the booking to John Doe on the UI!');
  });
});
req.on('error', e => {
  console.error('❌ Error Code:', e.code || 'UNKNOWN');
  console.error('❌ Error Message:', e.message || '(empty)');
  if (e.code === 'ECONNREFUSED') {
    console.error('   Server is not running on port 5000. Start it with: npm run dev');
  } else if (e.code === 'ECONNRESET') {
    console.error('   Server reset the connection. The server may be restarting (nodemon).');
    console.error('   Wait a few seconds and try again.');
  }
});
req.setTimeout(10000, () => {
  console.error('❌ Request timed out after 10 seconds.');
  req.destroy();
});
req.write(payload);
req.end();
