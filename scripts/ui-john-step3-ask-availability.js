/**
 * UI STEP 3 — John Doe asks about availability for tomorrow
 * Run: node scripts/ui-john-step3-ask-availability.js
 */
const http = require('http');
const crypto = require('crypto');

const HOTEL_ID = 13;
const JOHN_PHONE = '15559876543';
const MESSAGE = 'Is there availability for tomorrow night? I want to check in tomorrow and check out the day after.';

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
          id: `wamid.ui_step3_${Date.now()}`,
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
    console.log('👁️  Watch the UI! The AI will check live room availability in Mews.');
    console.log('\n▶  Run next: node scripts/ui-john-step4-book-room.js');
  });
});
req.on('error', e => console.error('❌ Error:', e.message));
req.write(payload);
req.end();
