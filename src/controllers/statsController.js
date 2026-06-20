const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/responseHandler');

/**
 * Dashboard Stats Controller
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const activeConversations = await prisma.conversation.count({
    where: { status: 'active' }
  });

  const pendingTakeovers = await prisma.conversation.count({
    where: { status: 'escalated' }
  });

  const totalMessages = await prisma.message.count();
  const aiMessages = await prisma.message.count({
    where: { senderType: 'ai' }
  });
  const handlingRate = totalMessages > 0 ? (aiMessages / totalMessages) * 100 : 0;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const revenueToday = await prisma.billingHistory.aggregate({
    _sum: { amount: true },
    where: { 
      date: { gte: todayStart },
      status: 'Paid'
    }
  });

  const hotel = await prisma.hotel.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  const activityLogs = await prisma.activityLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      conversation: {
        include: { guest: true }
      }
    }
  });

  return sendSuccess(res, 200, {
    metrics: {
      activeConversations,
      pendingTakeovers,
      handlingRate: handlingRate.toFixed(1),
      revenueToday: revenueToday._sum.amount || 0
    },
    integrations: {
      pms: hotel?.pmsConnected || false,
      whatsapp: hotel?.whatsappConnected || false,
      email: hotel?.emailConnected || false
    },
    activity: activityLogs.map(log => ({
      id: log.id,
      guestName: log.conversation?.guest?.name || 'System',
      roomNumber: log.conversation?.guest?.roomNumber || 'N/A',
      action: log.actionType,
      details: log.actionDetails,
      time: log.createdAt
    }))
  });
});

module.exports = {
  getDashboardStats
};
