// This simulates exactly what Meta's WhatsApp Cloud API sends to your webhook
// Run this WHILE your backend (npm run dev) is running on port 5000
const crypto = require('crypto');

const HOTEL_ID = 13;
const BACKEND_URL = 'http://localhost:5000';

// The WhatsApp App Secret for Hotel 13 (from DB). 
// Since we don't have it here, we'll skip signature verification
// Your backend already handles this gracefully with a warning log.
const DUMMY_APP_SECRET = 'test_secret_for_mock';

// ============ MOCK PAYLOAD ============
// This is the EXACT format Meta sends to your webhook
const mockPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "ENTRY_ID_12345",
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15550123456",
              phone_number_id: "PHONE_NUMBER_ID_FROM_DB" // This gets matched to hotel in your DB
            },
            messages: [
              {
                from: "+491234567890", // Guest's WhatsApp phone number
                id: "wamid.MOCK_MESSAGE_ID_" + Date.now(),
                timestamp: Math.floor(Date.now() / 1000).toString(),
                text: {
                  body: "Hi! I want to book a room for 2 nights starting July 1st 2026. What is available?"
                },
                type: "text"
              }
            ]
          },
          field: "messages"
        }
      ]
    }
  ]
};

// ============ SIGN THE PAYLOAD ============
const payloadStr = JSON.stringify(mockPayload);
const signature = 'sha256=' + crypto.createHmac('sha256', DUMMY_APP_SECRET).update(payloadStr).digest('hex');

// ============ SEND TO BACKEND ============
async function fireWebhook() {
  console.log(`=======================================================`);
  console.log(`🎬 RUNNING SCENARIO 8: Mock WhatsApp Webhook`);
  console.log(`Simulating Meta Cloud API → Your Server`);
  console.log(`Target: POST ${BACKEND_URL}/api/whatsapp/${HOTEL_ID}`);
  console.log(`=======================================================`);
  console.log(`\n📦 Webhook Payload being sent:`);
  console.log(JSON.stringify(mockPayload, null, 2));
  console.log(`\n🔐 X-Hub-Signature-256: ${signature}`);

  try {
    const response = await fetch(`${BACKEND_URL}/api/whatsapp/${HOTEL_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signature
      },
      body: payloadStr
    });

    const responseText = await response.text();
    console.log(`\n✅ Backend Response Status: ${response.status}`);
    console.log(`Backend Response Body: ${responseText}`);
    console.log(`\n💡 NOTE: The backend responds immediately with "EVENT_RECEIVED"`);
    console.log(`         then processes the AI in the background.`);
    console.log(`         Watch your backend terminal logs to see the full AI execution!`);

  } catch (err) {
    console.error('Webhook POST failed:', err.message);
    console.log('\n⚠️  Make sure your backend is running: cd "New folder/pms-hotels" && npm run dev');
  }
}

fireWebhook();
