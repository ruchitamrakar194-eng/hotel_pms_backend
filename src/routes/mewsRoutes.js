const express = require('express');
const router = express.Router();
const mewsController = require('../controllers/mewsController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/test', mewsController.testConnection);
router.get('/guest', requireAuth, mewsController.getGuestProfile);
router.get('/occupancy', requireAuth, mewsController.getOccupancy);
router.get('/arrivals', requireAuth, mewsController.getArrivals);

module.exports = router;
