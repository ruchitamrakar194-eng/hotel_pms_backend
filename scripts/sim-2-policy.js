const http = require('http');

function sendWebhook(message) {
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
              "contacts": [{"profile": {"name": "testing_profeesional"}, "wa_id": "15559876543"}],
              "messages": [
                {
                  "from": "15559876543",
                  "id": "wamid." + Math.random().toString(36).substring(7),
                  "timestamp": Math.floor(Date.now() / 1000).toString(),
                  "text": {"body": message},
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

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log(`\n✅ Sent: "${message}"`);
      console.log(`Response Status: ${res.statusCode} (Wait for AI reply in backend terminal...)`);
    });
  });

  req.on('error', (e) => console.error(e));
  req.write(payload);
  req.end();
}

// 2. Policy Question
sendWebhook("What time is late checkout?");
