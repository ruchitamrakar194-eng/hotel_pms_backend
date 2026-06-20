const express = require('express');
const requestController = require('../controllers/requestController');

const router = express.Router();

// GET /api/requests
router.get('/', requestController.getRequests);

// POST /api/requests
router.post('/', requestController.createRequest);

// PUT /api/requests/:id
router.put('/:id', requestController.updateRequest);

// DELETE /api/requests/:id
router.delete('/:id', requestController.deleteRequest);

// Public Onboarding Flow
router.get('/onboarding/:token', requestController.getByToken);
router.post('/onboarding/:token/credentials', requestController.submitCredentials);
router.post('/onboarding/:token/message', requestController.postClientMessage);

module.exports = router;
