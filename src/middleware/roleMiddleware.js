const { sendError } = require('../utils/responseHandler');

/**
 * Role Middleware validating user permissions and roles
 */
const requireRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return sendError(res, 403, 'Forbidden: Insufficient privileges for this resource');
  }
  next();
};

module.exports = {
  requireRole
};
