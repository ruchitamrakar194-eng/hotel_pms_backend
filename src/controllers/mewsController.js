const mewsService = require('../services/mewsService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/responseHandler');

/**
 * Mews Controller
 */
const testConnection = asyncHandler(async (req, res) => {
  try {
    const result = await mewsService.testConnection();
    return sendSuccess(res, 200, { 
      status: 'Connected', 
      hotelName: result.Enterprise.Name 
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Mews Connection Failed', 
      details: error.message 
    });
  }
});

const getGuestProfile = asyncHandler(async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }
  const result = await mewsService.getGuestProfile(email);
  return sendSuccess(res, 200, result);
});

const getOccupancy = asyncHandler(async (req, res) => {
  const { start, end } = req.query;
  const result = await mewsService.getOccupancy(
    start || new Date().toISOString(),
    end || new Date(Date.now() + 86400000).toISOString()
  );
  return sendSuccess(res, 200, result);
});

const getArrivals = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tonight = new Date(today);
  tonight.setHours(23, 59, 59, 999);

  const result = await mewsService.getArrivalsDepartures(
    today.toISOString(),
    tonight.toISOString()
  );
  return sendSuccess(res, 200, result);
});

module.exports = {
  testConnection,
  getGuestProfile,
  getOccupancy,
  getArrivals
};
