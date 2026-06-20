const authService = require('../services/authService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/responseHandler');

/**
 * Authentication Controller handling requests/responses for auth flows
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    const error = new Error('Email and password are required');
    error.statusCode = 400;
    throw error;
  }

  const result = await authService.login(email, password, req.ip, req.headers['user-agent']);

  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return sendSuccess(res, 200, result);
});

const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    const error = new Error('Name, email, and password are required');
    error.statusCode = 400;
    throw error;
  }

  const result = await authService.register(name, email, password, role, req.ip, req.headers['user-agent']);

  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000
  });

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  return sendSuccess(res, 201, result);
});

const logout = asyncHandler(async (req, res) => {
  const result = await authService.logout(req.user ? req.user.id : null, req.cookies ? req.cookies.refreshToken : null);
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  return sendSuccess(res, 200, result);
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    const error = new Error('Email is required');
    error.statusCode = 400;
    throw error;
  }
  const result = await authService.forgotPassword(email);
  return sendSuccess(res, 200, result);
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    const error = new Error('Token and new password are required');
    error.statusCode = 400;
    throw error;
  }
  const result = await authService.resetPassword(token, newPassword);
  return sendSuccess(res, 200, result);
});

const refreshToken = asyncHandler(async (req, res) => {
  const token = (req.cookies ? req.cookies.refreshToken : null) || req.body.refreshToken;
  if (!token) {
    const error = new Error('Refresh token required');
    error.statusCode = 400;
    throw error;
  }
  const result = await authService.refreshAccessToken(token);

  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000
  });

  return sendSuccess(res, 200, result);
});

const getUsers = asyncHandler(async (req, res) => {
  const users = await authService.getUsers();
  return sendSuccess(res, 200, users);
});

const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!role) {
    const error = new Error('Role is required');
    error.statusCode = 400;
    throw error;
  }
  const result = await authService.updateUserRole(req.params.id, role);
  return sendSuccess(res, 200, result);
});

const deleteUser = asyncHandler(async (req, res) => {
  const result = await authService.deleteUser(req.params.id);
  return sendSuccess(res, 200, result);
});

const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getUserById(req.user.id);
  return sendSuccess(res, 200, { user });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    const error = new Error('Current password and new password are required');
    error.statusCode = 400;
    throw error;
  }
  const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
  return sendSuccess(res, 200, result);
});

module.exports = {
  login,
  register,
  logout,
  forgotPassword,
  resetPassword,
  refreshToken,
  getUsers,
  updateUserRole,
  deleteUser,
  getMe,
  changePassword
};
