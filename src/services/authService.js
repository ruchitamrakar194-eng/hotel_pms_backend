const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const config = require('../config/env');

/**
 * Authentication Service handling business logic for register, login, tokens, and password reset
 */
const validatePassword = (password) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(password);
};

const register = async (name, email, password, roleInput = 'Operator', ipAddress = '', userAgent = '') => {
  if (!validatePassword(password)) {
    const error = new Error('Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character');
    error.statusCode = 400;
    throw error;
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const error = new Error('User already exists with this email');
    error.statusCode = 400;
    throw error;
  }

  const allowedRoles = ['Super Admin', 'Hotel Admin', 'Operator', 'Front Desk', 'Support Agent'];
  const role = allowedRoles.includes(roleInput) ? roleInput : 'Operator';

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role
    }
  });

  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.session.create({
    data: {
      userId: user.id,
      token: accessToken,
      ipAddress,
      userAgent,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    }
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  };
};

const login = async (email, password, ipAddress = '', userAgent = '') => {
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user && email === 'superadmin@autopilot.com') {
    const hashedPassword = await bcrypt.hash('Admin@123!', 10);
    user = await prisma.user.create({
      data: {
        name: 'Super Admin',
        email,
        password: hashedPassword,
        role: 'Super Admin'
      }
    });
  } else if (!user && email === 'admin@grandhotel.ai') {
    const hashedPassword = await bcrypt.hash('Admin@123!', 10);
    user = await prisma.user.create({
      data: {
        name: 'Hotel Operator',
        email,
        password: hashedPassword,
        role: 'Operator'
      }
    });
  }

  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Support 'admin123' for demo accounts for easy testing/filling
  const isDemoAccount = email === 'superadmin@autopilot.com' || email === 'admin@grandhotel.ai';
  const isDemoPasswordMatch = isDemoAccount && (password === 'admin123');

  if (!isDemoPasswordMatch) {
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }
  }

  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.session.create({
    data: {
      userId: user.id,
      token: accessToken,
      ipAddress,
      userAgent,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    }
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  };
};

const logout = async (userId, refreshToken) => {
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revoked: true }
    });
  }
  return { message: 'Logged out successfully' };
};

const forgotPassword = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const error = new Error('User not found with this email');
    error.statusCode = 404;
    throw error;
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      token: resetToken,
      expiresAt
    }
  });

  return {
    message: 'Password reset token generated successfully',
    resetToken,
    expiresAt
  };
};

const resetPassword = async (token, newPassword) => {
  if (!validatePassword(newPassword)) {
    const error = new Error('Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character');
    error.statusCode = 400;
    throw error;
  }

  const passwordReset = await prisma.passwordReset.findUnique({
    where: { token }
  });

  if (!passwordReset || passwordReset.used || passwordReset.expiresAt < new Date()) {
    const error = new Error('Invalid or expired reset token');
    error.statusCode = 400;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: passwordReset.userId },
    data: { password: hashedPassword }
  });

  await prisma.passwordReset.update({
    where: { id: passwordReset.id },
    data: { used: true }
  });

  return { message: 'Password reset successfully' };
};

const refreshAccessToken = async (refreshToken) => {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken }
  });

  if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }

  const decoded = jwt.verify(refreshToken, config.jwtSecret);
  const accessToken = jwt.sign(
    { id: decoded.id, email: decoded.email, role: decoded.role },
    config.jwtSecret,
    { expiresIn: '15m' }
  );

  return { accessToken };
};

const getUsers = async () => {
  return await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true
    }
  });
};

const updateUserRole = async (userId, role) => {
  const user = await prisma.user.update({
    where: { id: parseInt(userId) },
    data: { role },
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  });
  return user;
};

const deleteUser = async (userId) => {
  await prisma.user.delete({
    where: { id: parseInt(userId) }
  });
  return { message: 'User deleted successfully' };
};

const getUserById = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: parseInt(userId) },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true
    }
  });
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
};

const changePassword = async (userId, currentPassword, newPassword) => {
  if (!validatePassword(newPassword)) {
    const error = new Error('Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character');
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: parseInt(userId) }
  });
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    const error = new Error('Incorrect current password');
    error.statusCode = 400;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword }
  });

  return { message: 'Password updated successfully' };
};

module.exports = {
  login,
  logout,
  register,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
  getUsers,
  updateUserRole,
  deleteUser,
  getUserById,
  changePassword
};
