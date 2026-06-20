const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/hotelController');

// In Phase 1 we will add auth middleware later. For now, let's get the data flowing.
router.get('/', hotelController.getHotels);
router.get('/settings', hotelController.getHotelSettings);
router.post('/', hotelController.createHotel);
router.put('/settings', hotelController.updateHotelSettings);
router.put('/:id', hotelController.updateHotel);
router.delete('/:id', hotelController.deleteHotel);

module.exports = router;
