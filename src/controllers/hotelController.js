const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/responseHandler');
const { encrypt } = require('../utils/cryptoUtils');

const encryptSecrets = (data) => {
  if (data.pmsApiKey) data.pmsApiKey = encrypt(data.pmsApiKey);
  if (data.pmsSecret) data.pmsSecret = encrypt(data.pmsSecret);
  if (data.whatsappApiKey) data.whatsappApiKey = encrypt(data.whatsappApiKey);
  if (data.whatsappAppSecret) data.whatsappAppSecret = encrypt(data.whatsappAppSecret);
  if (data.smtpPass) data.smtpPass = encrypt(data.smtpPass);
  if (data.smtpPort !== undefined && data.smtpPort !== null) {
    data.smtpPort = parseInt(data.smtpPort, 10);
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
  const updates = encryptSecrets(req.body);
  
  const hotel = await prisma.hotel.update({
    where: { id: parseInt(id) },
    data: updates
  });
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
  
  const updates = encryptSecrets(req.body);
  const updatedHotel = await prisma.hotel.update({
    where: { id: hotel.id },
    data: updates
  });
  
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
