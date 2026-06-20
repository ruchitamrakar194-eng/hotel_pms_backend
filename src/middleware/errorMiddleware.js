const { sendError } = require('../utils/responseHandler');

/**
 * Centralized error handling middleware
 */
const errorMiddleware = (err, req, res, next) => {
  console.error('Error caught by middleware:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return sendError(res, statusCode, message, err.stack);
};

module.exports = errorMiddleware;
