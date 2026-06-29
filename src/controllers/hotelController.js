const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/responseHandler');
const { encrypt } = require('../utils/cryptoUtils');

const encryptSecrets = (data, existingHotel = {}) => {
  if (data.pmsApiKey && data.pmsApiKey !== existingHotel.pmsApiKey) data.pmsApiKey = encrypt(data.pmsApiKey);
  if (data.pmsSecret && data.pmsSecret !== existingHotel.pmsSecret) data.pmsSecret = encrypt(data.pmsSecret);
  if (data.whatsappApiKey && data.whatsappApiKey !== existingHotel.whatsappApiKey) data.whatsappApiKey = encrypt(data.whatsappApiKey);
  if (data.whatsappAppSecret && data.whatsappAppSecret !== existingHotel.whatsappAppSecret) data.whatsappAppSecret = encrypt(data.whatsappAppSecret);
  if (data.smtpPass && data.smtpPass !== existingHotel.smtpPass) data.smtpPass = encrypt(data.smtpPass);
  if (data.imapPass && data.imapPass !== existingHotel.imapPass) data.imapPass = encrypt(data.imapPass);
  if (data.smtpPort !== undefined && data.smtpPort !== null) {
    data.smtpPort = parseInt(data.smtpPort, 10);
  }
  if (data.imapPort !== undefined && data.imapPort !== null) {
    data.imapPort = parseInt(data.imapPort, 10);
  }
  // Reset health status on config update
  if (data.whatsappApiKey || data.whatsappAppSecret || data.whatsappPhoneId || data.whatsappVerifyToken) {
    data.whatsappHealthStatus = 'ok';
    data.whatsappHealthNote = null;
  }
  return data;
};

const getHotels = asyncHandler(async (req, res) => {
  const hotels = await prisma.hotel.findMany({
    orderBy: { createdAt: 'desc' }
  });
  return sendSuccess(res, 200, hotels);
});

const createHotel = asyncHandler(async (req, res) => {
  const { hotelName, pmsProvider, plan, roomCount } = req.body;
  
  const hotel = await prisma.hotel.create({
    data: {
      hotelName,
      pmsProvider,
      subscriptionPlan: plan || 'Standard',
      totalRooms: roomCount || 0,
      aiStatus: 'Active',
      onboardingStatus: 'Completed',
      whatsappConnected: false,
      pmsConnected: false
    }
  });
  
  return sendSuccess(res, 201, hotel);
});

const updateHotel = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Optionally, validate IMAP/SMTP here if credentials are provided in req.body
  // Since this is a simple update, we just encrypt.
  const existingHotel = await prisma.hotel.findUnique({ where: { id: parseInt(id) } });
  if (!existingHotel) return res.status(404).json({ success: false, message: 'Hotel not found' });
  const updates = encryptSecrets(req.body, existingHotel);
  
  const hotel = await prisma.hotel.update({
    where: { id: parseInt(id) },
    data: updates
  });

  // If IMAP credentials were changed, restart listener
  if (req.body.imapHost && req.body.imapUser && req.body.imapPass) {
      const imapService = require('../services/imapService');
      imapService.startListener(hotel); // Will connect using the new credentials
  }

  return sendSuccess(res, 200, hotel);
});

const deleteHotel = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.hotel.delete({
    where: { id: parseInt(id) }
  });
  return sendSuccess(res, 200, { message: 'Hotel deleted successfully' });
});

const getHotelSettings = asyncHandler(async (req, res) => {
  // In a real multi-tenant app, we'd use req.user.hotelId
  // For now, we'll use the first hotel as the "active" one
  const hotel = await prisma.hotel.findFirst();
  if (!hotel) {
    return res.status(404).json({ success: false, message: 'Hotel not found' });
  }
  return sendSuccess(res, 200, hotel);
});

const updateHotelSettings = asyncHandler(async (req, res) => {
  const hotel = await prisma.hotel.findFirst();
  if (!hotel) {
    return res.status(404).json({ success: false, message: 'Hotel not found' });
  }
  
  // Validate IMAP / SMTP if provided
  if (req.body.imapHost && req.body.imapUser && req.body.imapPass) {
    const { ImapFlow } = require('imapflow');
    const { decrypt } = require('../utils/cryptoUtils');
    
    // If the frontend sent the exact encrypted hash from the database, decrypt it so we can test the connection
    let passToTest = req.body.imapPass;
    if (passToTest === hotel.imapPass) {
      passToTest = decrypt(passToTest);
    }

    try {
      const client = new ImapFlow({
        host: req.body.imapHost,
        port: parseInt(req.body.imapPort) || 993,
        secure: req.body.imapTls !== false,
        auth: { user: req.body.imapUser, pass: passToTest },
        logger: false
      });
      await client.connect();
      await client.logout();
    } catch (error) {
      return res.status(400).json({ success: false, message: 'IMAP Authentication Failed: ' + error.message });
    }
  }

  const updates = encryptSecrets(req.body, hotel);
  const updatedHotel = await prisma.hotel.update({
    where: { id: hotel.id },
    data: updates
  });
  
  // If IMAP credentials were changed, restart listener
  if (req.body.imapHost && req.body.imapUser && req.body.imapPass) {
      const imapService = require('../services/imapService');
      imapService.startListener(updatedHotel);
  }

  return sendSuccess(res, 200, updatedHotel);
});

module.exports = {
  getHotels,
  createHotel,
  updateHotel,
  deleteHotel,
  getHotelSettings,
  updateHotelSettings
};
