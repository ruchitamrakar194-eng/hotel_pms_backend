const express = require('express');
const guestController = require('../controllers/guestController');

const router = express.Router();

// GET /api/guests
router.get('/', guestController.getGuests);

// GET /api/guests/:id
router.get('/:id', guestController.getGuest);

// POST /api/guests
router.post('/', guestController.createGuest);

// PUT /api/guests/:id
router.put('/:id', guestController.updateGuest);

// DELETE /api/guests/:id
router.delete('/:id', guestController.deleteGuest);

module.exports = router;
