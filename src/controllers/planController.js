const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/responseHandler');

/**
 * Get all subscription plans
 */
const getPlans = asyncHandler(async (req, res) => {
  const plans = await prisma.plan.findMany({
    orderBy: { price: 'asc' }
  });
  
  // Seed initial plans if none exist
  if (plans.length === 0) {
    const initialPlans = [
      { name: 'Starter', price: 199, duration: 'Monthly', features: 'Up to 50 Rooms, AI Guest Support, Email Integration' },
      { name: 'Professional', price: 399, duration: 'Monthly', features: 'Up to 150 Rooms, Advanced AI, WhatsApp & Email, Priority Support' },
      { name: 'Enterprise', price: 799, duration: 'Monthly', features: 'Unlimited Rooms, Custom RAG pipeline, PMS Deep Sync, 24/7 Dedicated Support' }
    ];
    
    await prisma.plan.createMany({ data: initialPlans });
    const newlyCreated = await prisma.plan.findMany({ orderBy: { price: 'asc' } });
    return sendSuccess(res, 200, newlyCreated);
  }

  return sendSuccess(res, 200, plans);
});

/**
 * Create a new subscription plan
 */
const createPlan = asyncHandler(async (req, res) => {
  const { name, price, duration, features } = req.body;
  
  const plan = await prisma.plan.create({
    data: {
      name,
      price: parseFloat(price),
      duration,
      features
    }
  });
  
  return sendSuccess(res, 201, plan);
});

/**
 * Update a subscription plan
 */
const updatePlan = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, price, duration, features } = req.body;
  
  const plan = await prisma.plan.update({
    where: { id: parseInt(id) },
    data: {
      name,
      price: parseFloat(price),
      duration,
      features
    }
  });
  
  return sendSuccess(res, 200, plan);
});

/**
 * Delete a subscription plan
 */
const deletePlan = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  await prisma.plan.delete({
    where: { id: parseInt(id) }
  });
  
  return sendSuccess(res, 200, { message: 'Plan deleted successfully' });
});

/**
 * Get global billing history
 */
const getBillingHistory = asyncHandler(async (req, res) => {
  const history = await prisma.billingHistory.findMany({
    orderBy: { date: 'desc' }
  });
  
  // Seed initial history if none exist for demo
  if (history.length === 0) {
    const initialHistory = [
      { reference: '#PAY-2026-001', hotelName: 'Grand AutoPilot Resort', amount: 399.00, status: 'Paid', date: new Date('2026-05-01') },
      { reference: '#PAY-2026-002', hotelName: 'Grand AutoPilot Resort', amount: 399.00, status: 'Paid', date: new Date('2026-04-01') },
      { reference: '#PAY-2026-003', hotelName: 'Azure Bay Hotel', amount: 199.00, status: 'Paid', date: new Date('2026-05-05') }
    ];
    await prisma.billingHistory.createMany({ data: initialHistory });
    const newlyCreated = await prisma.billingHistory.findMany({ orderBy: { date: 'desc' } });
    return sendSuccess(res, 200, newlyCreated);
  }

  return sendSuccess(res, 200, history);
});

module.exports = {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getBillingHistory
};
