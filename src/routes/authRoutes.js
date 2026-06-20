const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/register
router.post('/register', authController.register);

// POST /api/auth/logout
router.post('/logout', authController.logout);

// POST /api/auth/forgot-password
router.post('/forgot-password', authController.forgotPassword);

// POST /api/auth/reset-password
router.post('/reset-password', authController.resetPassword);

// POST /api/auth/refresh-token
router.post('/refresh-token', authController.refreshToken);

// GET /api/auth/users
router.get('/users', requireAuth, authController.getUsers);

// PATCH /api/auth/users/:id/role
router.patch('/users/:id/role', requireAuth, authController.updateUserRole);

// DELETE /api/auth/users/:id
router.delete('/users/:id', requireAuth, authController.deleteUser);

// GET /api/auth/me
router.get('/me', requireAuth, authController.getMe);

// POST /api/auth/change-password
router.post('/change-password', requireAuth, authController.changePassword);

module.exports = router;
