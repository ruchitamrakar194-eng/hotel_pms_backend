const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { decrypt } = require('../src/utils/cryptoUtils');
const mewsService = require('../src/services/mewsService');

async function testCredentials() {
  const hotelId = 13;
  console.log(`\n--- Testing Credentials for Hotel ID: ${hotelId} ---\n`);

  try {
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) {
      console.log('Hotel not found!');
      return;
    }

    // 1. Test Mews PMS
    console.log('1. Testing Mews PMS Connection...');
    if (hotel.pmsApiKey && hotel.pmsSecret) {
      try {
        const result = await mewsService.getServices(hotelId);
        console.log('✅ MEWS CONNECTION SUCCESSFUL!');
        console.log(`   Retrieved ${result.Services ? result.Services.length : 0} services from Mews.`);
      } catch (err) {
        console.log('❌ MEWS CONNECTION FAILED!');
        console.log(`   Error: ${err.message}`);
      }
    } else {
      console.log('   Mews credentials are not configured.');
    }

    console.log('\n----------------------------------------\n');

    // 2. Test WhatsApp Cloud API
    console.log('2. Testing WhatsApp Business API Connection...');
    if (hotel.whatsappApiKey && hotel.whatsappPhoneId) {
      try {
        const accessToken = decrypt(hotel.whatsappApiKey);
        const phoneId = hotel.whatsappPhoneId;
        
        // Fetch phone number details from Meta Graph API
        const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        const result = await response.json();
        
        if (response.ok) {
          console.log('✅ WHATSAPP CONNECTION SUCCESSFUL!');
          console.log(`   Verified Phone Number ID: ${result.id}`);
          if (result.display_phone_number) {
            console.log(`   Display Number: ${result.display_phone_number}`);
          }
        } else {
          console.log('❌ WHATSAPP CONNECTION FAILED!');
          console.log(`   Error: ${result.error?.message || response.statusText}`);
        }
      } catch (err) {
        console.log('❌ WHATSAPP CONNECTION FAILED!');
        console.log(`   Error: ${err.message}`);
      }
    } else {
      console.log('   WhatsApp credentials are not configured.');
    }

  } catch (error) {
    console.error('Test script error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCredentials();
