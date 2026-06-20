require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mewsService = require('../src/services/mewsService');

async function testRawCredentials() {
  console.log(`\n--- Testing RAW Credentials ---\n`);

  // Mews
  console.log('1. Testing Mews PMS Connection...');
  const mewsUrl = 'https://api.mews-demo.com/api/connector/v1'; // Assuming demo for now, or production: https://api.mews.com/api/connector/v1
  
  // Read from environment variables
  const clientToken = process.env.MEWS_CLIENT_TOKEN;
  const accessToken = process.env.MEWS_ACCESS_TOKEN;
  
  const payload = {
    ClientToken: clientToken,
    AccessToken: accessToken
  };

  try {
    const response = await fetch(`${mewsUrl}/services/getAll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    if (response.ok) {
      console.log('✅ MEWS DEMO URL CONNECTION SUCCESSFUL!');
    } else {
      console.log(`❌ MEWS DEMO URL FAILED: ${result.Message || response.statusText}`);
      
      // Try Production URL just in case
      console.log('   Trying Production URL...');
      const prodResponse = await fetch(`https://api.mews.com/api/connector/v1/services/getAll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const prodResult = await prodResponse.json();
      if (prodResponse.ok) {
         console.log('✅ MEWS PRODUCTION URL CONNECTION SUCCESSFUL!');
      } else {
         console.log(`❌ MEWS PROD URL FAILED: ${prodResult.Message || prodResponse.statusText}`);
      }
    }
  } catch (err) {
    console.log('❌ MEWS REQUEST FAILED:', err.message);
  }

  console.log('\n----------------------------------------\n');

  // WhatsApp
  console.log('2. Testing WhatsApp Business API Connection...');
  const phoneId = "1122308060957206";
  // Read from environment variables
  const rawToken = process.env.WHATSAPP_TOKEN || "";
  const cleanedToken = rawToken.replace('>', '');

  console.log(`   Trying Raw Token: ${rawToken}`);
  try {
    let res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}`, {
      headers: { 'Authorization': `Bearer ${rawToken}` }
    });
    let data = await res.json();
    if (res.ok) console.log('✅ RAW WHATSAPP TOKEN WORKS!');
    else {
      console.log(`❌ RAW TOKEN FAILED: ${data.error?.message}`);
      console.log(`\n   Trying Cleaned Token (removed > at end): ${cleanedToken}`);
      
      res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}`, {
        headers: { 'Authorization': `Bearer ${cleanedToken}` }
      });
      data = await res.json();
      if (res.ok) console.log('✅ CLEANED WHATSAPP TOKEN WORKS!');
      else console.log(`❌ CLEANED TOKEN FAILED: ${data.error?.message}`);
    }
  } catch(err) {
    console.log(`❌ WHATSAPP REQUEST FAILED: ${err.message}`);
  }
}

testRawCredentials();
