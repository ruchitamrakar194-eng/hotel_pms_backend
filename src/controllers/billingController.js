const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/responseHandler');

// Helper function to format subscription object
const formatSubscription = (hotel) => {
  const price = hotel.subscriptionPlan === 'Starter' ? 199 : (hotel.subscriptionPlan === 'Enterprise' ? 799 : 399);
  return {
    id: hotel.id,
    hotelName: hotel.hotelName,
    subscriptionPlan: hotel.subscriptionPlan,
    status: hotel.isPaused ? 'Suspended' : 'Active',
    isPaused: hotel.isPaused,
    price: price,
    billingInterval: 'Monthly',
    nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    cardBrand: 'Visa',
    cardLast4: '4242',
    billingEmail: hotel.hotelEmail || 'billing@hotel.com',
  };
};

/**
 * Get subscription details for a specific hotel
 */
const getHotelSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const hotel = await prisma.hotel.findUnique({
    where: { id: parseInt(id) }
  });

  if (!hotel) {
    return sendError(res, 404, 'Hotel not found');
  }

  return sendSuccess(res, 200, formatSubscription(hotel));
});

/**
 * Update mock billing/payment method details
 */
const updateHotelSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { billingEmail } = req.body;

  const hotel = await prisma.hotel.findUnique({
    where: { id: parseInt(id) }
  });

  if (!hotel) {
    return sendError(res, 404, 'Hotel not found');
  }

  const updatedHotel = await prisma.hotel.update({
    where: { id: parseInt(id) },
    data: {
      hotelEmail: billingEmail || hotel.hotelEmail
    }
  });

  return sendSuccess(res, 200, formatSubscription(updatedHotel));
});

/**
 * Update plan for a hotel subscription
 */
const changePlan = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPlan } = req.body;

  const hotel = await prisma.hotel.findUnique({
    where: { id: parseInt(id) }
  });

  if (!hotel) {
    return sendError(res, 404, 'Hotel not found');
  }

  const updatedHotel = await prisma.hotel.update({
    where: { id: parseInt(id) },
    data: {
      subscriptionPlan: newPlan
    }
  });

  return sendSuccess(res, 200, formatSubscription(updatedHotel));
});

/**
 * Pause or resume a hotel subscription
 */
const pauseSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { pause } = req.body;

  const hotel = await prisma.hotel.findUnique({
    where: { id: parseInt(id) }
  });

  if (!hotel) {
    return sendError(res, 404, 'Hotel not found');
  }

  const updatedHotel = await prisma.hotel.update({
    where: { id: parseInt(id) },
    data: {
      isPaused: !!pause
    }
  });

  return sendSuccess(res, 200, formatSubscription(updatedHotel));
});

/**
 * Get invoices for a specific hotel
 */
const getHotelInvoices = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const hotel = await prisma.hotel.findUnique({
    where: { id: parseInt(id) }
  });

  if (!hotel) {
    return sendError(res, 404, 'Hotel not found');
  }

  const invoices = await prisma.billingHistory.findMany({
    where: { hotelName: hotel.hotelName },
    orderBy: { date: 'desc' }
  });

  // Seed demo invoice if none exists to ensure page works nicely
  if (invoices.length === 0) {
    const defaultInvoice = {
      reference: `#INV-${Date.now().toString().slice(-4)}`,
      hotelName: hotel.hotelName,
      amount: hotel.subscriptionPlan === 'Starter' ? 199 : (hotel.subscriptionPlan === 'Enterprise' ? 799 : 399),
      status: 'Paid',
      date: new Date()
    };
    const createdInvoice = await prisma.billingHistory.create({
      data: defaultInvoice
    });
    return sendSuccess(res, 200, [createdInvoice]);
  }

  return sendSuccess(res, 200, invoices);
});

/**
 * Get platform-wide revenue metrics for admin
 */
const getAdminRevenue = asyncHandler(async (req, res) => {
  const history = await prisma.billingHistory.findMany();
  const hotels = await prisma.hotel.findMany();

  const totalRevenue = history.reduce((sum, h) => sum + h.amount, 0);

  let mrr = 0;
  let activeSubscriptions = 0;

  hotels.forEach(h => {
    if (!h.isPaused) {
      activeSubscriptions++;
      const price = h.subscriptionPlan === 'Starter' ? 199 : (h.subscriptionPlan === 'Enterprise' ? 799 : 399);
      mrr += price;
    }
  });

  const failedPayments = await prisma.billingHistory.count({
    where: { status: 'Failed' }
  });

  return sendSuccess(res, 200, {
    totalRevenue,
    activeSubscriptions,
    mrr,
    failedPaymentsCount: failedPayments
  });
});

/**
 * Get list of all hotel subscriptions for admin
 */
const getAdminSubscriptions = asyncHandler(async (req, res) => {
  const hotels = await prisma.hotel.findMany();
  const formatted = hotels.map(h => {
    const price = h.subscriptionPlan === 'Starter' ? 199 : (h.subscriptionPlan === 'Enterprise' ? 799 : 399);
    return {
      id: h.id,
      hotelName: h.hotelName,
      subscriptionPlan: h.subscriptionPlan,
      isPaused: h.isPaused,
      status: h.isPaused ? 'Suspended' : 'Active',
      price: price,
      totalRooms: h.totalRooms,
      pmsProvider: h.pmsProvider,
      createdAt: h.createdAt
    };
  });
  return sendSuccess(res, 200, formatted);
});

/**
 * Get platform-wide failed payments
 */
const getAdminFailedPayments = asyncHandler(async (req, res) => {
  const failed = await prisma.billingHistory.findMany({
    where: { status: 'Failed' },
    orderBy: { date: 'desc' }
  });
  return sendSuccess(res, 200, failed);
});

/**
 * Get all global invoices
 */
const getAdminInvoices = asyncHandler(async (req, res) => {
  const history = await prisma.billingHistory.findMany({
    orderBy: { date: 'desc' }
  });
  return sendSuccess(res, 200, history);
});

module.exports = {
  getHotelSubscription,
  updateHotelSubscription,
  changePlan,
  pauseSubscription,
  getHotelInvoices,
  getAdminRevenue,
  getAdminSubscriptions,
  getAdminFailedPayments,
  getAdminInvoices
};
