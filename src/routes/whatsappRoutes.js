const express = require('express');
const router = express.Router();
const whatsappWebhookController = require('../controllers/whatsappWebhookController');

// Webhook Verification (Meta requires GET)
router.get('/:hotelId', whatsappWebhookController.verifyWebhook);

// Webhook Incoming Messages (Meta requires POST)
router.post('/:hotelId', whatsappWebhookController.handleIncoming);

module.exports = router;
