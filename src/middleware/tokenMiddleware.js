const jwt = require('jsonwebtoken');
const config = require('../config/env');
const prisma = require('../config/prisma');
const { sendError, sendSuccess } = require('../utils/responseHandler');

/**
 * Token Middleware handling auto refresh token logic
 */
const autoRefreshToken = async (req, res, next) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return sendError(res, 401, 'Refresh token required');
  }

  try {
    const decoded = jwt.verify(refreshToken, config.jwtSecret);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken }
    });

    if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
      return sendError(res, 401, 'Invalid or expired refresh token');
    }

    // Generate new access token (15 minutes)
    const newAccessToken = jwt.sign(
      { id: decoded.id, email: decoded.email, role: decoded.role },
      config.jwtSecret,
      { expiresIn: '15m' }
    );

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    req.user = decoded;
    next();
  } catch (err) {
    return sendError(res, 401, 'Invalid refresh token');
  }
};

module.exports = {
  autoRefreshToken
};
