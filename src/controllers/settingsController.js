const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/responseHandler');

/**
 * Get system-wide settings (Singleton)
 */
const getSettings = asyncHandler(async (req, res) => {
  let settings = await prisma.systemSettings.findFirst();
  
  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: { id: 1 } // Using defaults from schema
    });
  }
  
  return sendSuccess(res, 200, settings);
});

/**
 * Update system-wide settings
 */
const updateSettings = asyncHandler(async (req, res) => {
  const updates = req.body;
  
  // Ensure we are updating the singleton
  const settings = await prisma.systemSettings.upsert({
    where: { id: 1 },
    update: updates,
    create: { id: 1, ...updates }
  });
  
  return sendSuccess(res, 200, settings);
});

module.exports = {
  getSettings,
  updateSettings
};
