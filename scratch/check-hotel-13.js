const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const hotelId = 13;
    console.log(`Checking Hotel ID: ${hotelId}`);
    
    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId }
    });
    
    if (hotel) {
      console.log('Hotel Found:', {
        id: hotel.id,
        name: hotel.hotelName,
        emailConnected: hotel.emailConnected,
        emailIntegrationType: hotel.emailIntegrationType,
        smtpHost: hotel.smtpHost,
        pmsConnected: hotel.pmsConnected,
        pmsProvider: hotel.pmsProvider
      });
      
      const onboardingRequest = await prisma.onboardingRequest.findFirst({
        where: { hotelName: hotel.hotelName }
      });
      
      if (onboardingRequest) {
          console.log('Related Onboarding Request found:');
          console.log({
              id: onboardingRequest.id,
              webhookUrl: onboardingRequest.webhookUrl,
              smtpHost: onboardingRequest.smtpHost
          });
      } else {
          console.log('No related Onboarding Request found.');
      }
    } else {
      console.log('Hotel 13 not found.');
    }
  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
