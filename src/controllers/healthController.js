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

module.exports = {
  checkHealth
};
