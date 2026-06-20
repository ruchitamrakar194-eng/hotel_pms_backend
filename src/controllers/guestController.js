const guestService = require('../services/guestService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/responseHandler');

/**
 * Guest Controller handling HTTP request/response for guests endpoints
 */
const getGuests = asyncHandler(async (req, res) => {
  const guests = await guestService.getAllGuests();
  return sendSuccess(res, 200, { guests });
});

const getGuest = asyncHandler(async (req, res) => {
  const guest = await guestService.getGuestById(req.params.id);
  return sendSuccess(res, 200, { guest });
});

const createGuest = asyncHandler(async (req, res) => {
  const guest = await guestService.createGuest(req.body);
  return sendSuccess(res, 201, { guest });
});

const updateGuest = asyncHandler(async (req, res) => {
  const guest = await guestService.updateGuest(req.params.id, req.body);
  return sendSuccess(res, 200, { guest });
});

const deleteGuest = asyncHandler(async (req, res) => {
  await guestService.deleteGuest(req.params.id);
  return sendSuccess(res, 200, { message: 'Guest deleted successfully' });
});

module.exports = {
  getGuests,
  getGuest,
  createGuest,
  updateGuest,
  deleteGuest
};
