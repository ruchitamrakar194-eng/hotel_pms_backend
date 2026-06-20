const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/dashboard', requireAuth, statsController.getDashboardStats);

module.exports = router;
