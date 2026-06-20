/**
 * Reusable API response helper
 */

const sendSuccess = (res, statusCode, data) => {
  return res.status(statusCode).json({
    success: true,
    data
  });
};

const sendError = (res, statusCode, message, details = null) => {
  const payload = {
    success: false,
    message
  };

  if (details && process.env.NODE_ENV !== 'production') {
    payload.details = details;
  }

  return res.status(statusCode).json(payload);
};

module.exports = {
  sendSuccess,
  sendError
};
