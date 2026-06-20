const express = require('express');
const conversationController = require('../controllers/conversationController');

const router = express.Router();

// GET /api/conversations
router.get('/', conversationController.getConversations);

// GET /api/conversations/:id/messages
router.get('/:id/messages', conversationController.getMessages);

// POST /api/conversations/:id/human-reply
router.post('/:id/human-reply', conversationController.humanReply);

// PUT /api/conversations/:id/return-to-ai
router.put('/:id/return-to-ai', conversationController.returnToAi);

module.exports = router;
