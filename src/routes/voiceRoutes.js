const express = require('express');
const voiceController = require('../controllers/voiceController');

const router = express.Router();

// POST /api/voice/start
router.post('/start', voiceController.startVoiceCall);

// POST /api/voice/process
router.post('/process', voiceController.processVoiceInput);

// POST /api/voice/end
router.post('/end', voiceController.endVoiceCall);

module.exports = router;
