const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { sendError } = require('../utils/responseHandler');

/**
 * Authentication Middleware validating JWT from headers or cookies
 */
const requireAuth = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return sendError(res, 401, 'Unauthorized access: Access token required');
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return sendError(res, 401, 'Unauthorized access: Invalid or expired access token');
  }
};

module.exports = {
  requireAuth
};
