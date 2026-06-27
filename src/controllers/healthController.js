const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/responseHandler');
const prisma = require('../config/prisma');

/**
 * Health Controller handling server health check
 */
const checkHealth = asyncHandler(async (req, res) => {
  // Verify Prisma database connectivity
  let dbStatus = "connected";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = "disconnected";
    console.error('Database connection verification failed in health check:', err.message);
  }

  return sendSuccess(res, 200, {
    message: "Backend running successfully",
    database: dbStatus,
    status: "OK"
  });
});

const checkImapHealth = asyncHandler(async (req, res) => {
  const imapService = require('../services/imapService');
  const activeHotels = await prisma.hotel.findMany({
    where: { imapHost: { not: null } },
    select: { id: true, hotelName: true }
  });

  const statuses = activeHotels.map(hotel => ({
    hotelId: hotel.id,
    hotelName: hotel.hotelName,
    ...imapService.getStats(hotel.id)
  }));

  return sendSuccess(res, 200, {
    message: "IMAP Listeners Status",
    totalConfigured: activeHotels.length,
    listeners: statuses
  });
});

module.exports = {
  checkHealth,
  checkImapHealth
};
