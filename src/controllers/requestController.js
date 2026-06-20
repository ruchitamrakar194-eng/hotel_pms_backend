const requestService = require('../services/requestService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/responseHandler');

/**
 * Onboarding Request Controller handling landing page requests and admin management
 */
const getRequests = asyncHandler(async (req, res) => {
  const requests = await requestService.getAllRequests();
  return sendSuccess(res, 200, { requests });
});

const createRequest = asyncHandler(async (req, res) => {
  const request = await requestService.createRequest(req.body);
  return sendSuccess(res, 201, { request });
});

const updateRequest = asyncHandler(async (req, res) => {
  const updated = await requestService.updateRequest(req.params.id, req.body);
  return sendSuccess(res, 200, { request: updated });
});

const deleteRequest = asyncHandler(async (req, res) => {
  await requestService.deleteRequest(req.params.id);
  return sendSuccess(res, 200, { message: 'Request removed successfully' });
});

const getByToken = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const request = await requestService.getRequestByToken(token);
  if (!request) {
    return res.status(404).json({ success: false, message: 'Invalid or expired onboarding token' });
  }
  return sendSuccess(res, 200, { request });
});

const submitCredentials = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const request = await requestService.submitCredentials(token, req.body);
  return sendSuccess(res, 200, { request });
});

const postClientMessage = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { text } = req.body;
  const request = await requestService.postClientMessage(token, text);
  return sendSuccess(res, 200, { request });
});

module.exports = {
  getRequests,
  createRequest,
  updateRequest,
  deleteRequest,
  getByToken,
  submitCredentials,
  postClientMessage
};
