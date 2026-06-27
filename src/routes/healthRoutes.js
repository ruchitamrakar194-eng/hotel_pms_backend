const express = require('express');
const { checkHealth, checkImapHealth } = require('../controllers/healthController');

const router = express.Router();

// GET /api/health
router.get('/', checkHealth);
router.get('/imap', checkImapHealth);

module.exports = router;
