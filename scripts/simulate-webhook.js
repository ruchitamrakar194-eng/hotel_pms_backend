const http = require('http');

const payload = JSON.stringify({
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "1234567890",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15550000000",
              "phone_number_id": "1122308060957206"
            },
            "contacts": [{"profile": {"name": "Test Guest"}, "wa_id": "15559876543"}],
            "messages": [
              {
                "from": "15559876543",
                "id": "wamid.HBg1",
                "timestamp": "1690000000",
                "text": {"body": "Hi, what time is late checkout?"},
                "type": "text"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/webhooks/whatsapp/13',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log('Sending Webhook Simulation to http://localhost:5000/api/webhooks/whatsapp/13...');

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`\nResponse Status: ${res.statusCode}`);
    console.log(`Response Body: ${data}`);
    if (res.statusCode === 200) {
      console.log('\n✅ SUCCESS! The webhook was hit perfectly. Check your backend terminal to see the AI processing the RAG Knowledge base!');
    } else {
      console.log('\n❌ FAILED! The server rejected the request.');
    }
  });
});

req.on('error', (e) => {
  console.error(`\n❌ ERROR: Cannot reach backend. Make sure 'npm run dev' is running in the pms-hotel folder! Error: ${e.message}`);
});

req.write(payload);
req.end();
