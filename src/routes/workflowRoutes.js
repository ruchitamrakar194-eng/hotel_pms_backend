const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/workflowController');
// const { protect } = require('../middlewares/authMiddleware'); // Assume protect is needed later

// Apply auth middleware if needed
router.get('/', workflowController.getWorkflows);
router.post('/', workflowController.createWorkflow);
router.put('/:id', workflowController.updateWorkflow);

module.exports = router;
