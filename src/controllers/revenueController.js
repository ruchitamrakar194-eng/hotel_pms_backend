const mockTransactions = [
  { id: 'AUT-1024', guest: 'Sarah Jenkins', service: 'Late Checkout Fee', amount: 30.00, status: 'Paid', date: '10:45 AM', channel: 'WhatsApp', source: 'Late Checkout Request #LC-928', convId: 1, pmsSync: 'Synced to Opera PMS', workflow: 'Auto Checkout Fee' },
  { id: 'AUT-1023', guest: 'Michael Chen', service: 'Spa Massage Booking', amount: 120.00, status: 'Paid', date: '09:20 AM', channel: 'Email', source: 'Amenity Inquiry #SPA-112', convId: 2, pmsSync: 'Synced to Opera PMS', workflow: 'Spa Booking Automation' },
  { id: 'AUT-1022', guest: 'Emma Wilson', service: 'Early Check-in Surcharge', amount: 25.00, status: 'Paid', date: 'Yesterday', channel: 'WhatsApp', source: 'Early Arrival Request #EC-304', convId: 1, pmsSync: 'Synced to Mews PMS', workflow: 'AI Service Recommendation' },
  { id: 'AUT-1021', guest: 'James Bond', service: 'Minibar Surcharges', amount: 45.00, status: 'Failed', date: 'Yesterday', channel: 'WhatsApp', source: 'Minibar Refill Request #MB-902', convId: 2, pmsSync: 'PMS posting failed', workflow: 'Minibar Detection' },
  { id: 'AUT-1020', guest: 'Sophia Loren', service: 'Premium Suite Upgrade', amount: 85.00, status: 'Paid', date: '2 days ago', channel: 'WhatsApp', source: 'Upsell Offer #UP-502', convId: 1, pmsSync: 'Synced to Mews PMS', workflow: 'AI Upsell' },
  { id: 'AUT-1019', guest: 'David Vance', service: 'Airport Shuttle Surcharge', amount: 50.00, status: 'Paid', date: '2 days ago', channel: 'Email', source: 'Airport Pickup Guide #AP-11', convId: 2, pmsSync: 'Charge added to folio', workflow: 'AI Service Recommendation' }
];

const getRevenue = (req, res) => {
  res.status(200).json({
    success: true,
    data: mockTransactions,
    totalRevenue: 4250.00,
    pmsSyncSuccess: '98.8%',
    aiUpsells: '142 Posts'
  });
};

module.exports = {
  getRevenue
};
