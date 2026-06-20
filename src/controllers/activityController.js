const prisma = require('../config/prisma');

const getActivityLogs = async (req, res) => {
  try {
    // Fetch conversations, including guest details, messages, and activity logs
    const conversations = await prisma.conversation.findMany({
      include: {
        guest: true,
        messages: {
          orderBy: { createdAt: 'asc' }
        },
        activityLogs: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 50 // Limit to last 50 interactions
    });

    const formattedLogs = conversations.map(c => {
      const guestMessages = c.messages.filter(m => m.senderType === 'guest');
      const aiMessages = c.messages.filter(m => m.senderType === 'ai' && m.content && m.content.trim());
      
      const firstRequest = guestMessages[0]?.content || '';
      const lastResponse = aiMessages[aiMessages.length - 1]?.content || '';
      
      const channel = c.messages[0]?.channel || 'WhatsApp';
      const formattedChannel = channel.charAt(0).toUpperCase() + channel.slice(1).toLowerCase();

      // Find if any escalation action took place
      const escalationLog = c.activityLogs.find(l => l.actionType === 'Escalation' || l.actionType === 'Escalation Triggered');
      
      // Determine request type
      let requestType = 'General Inquiry';
      if (c.activityLogs.some(l => l.actionType === 'BOOKING_CREATED')) {
        requestType = 'Room Booking';
      } else if (c.activityLogs.some(l => l.actionType === 'Message Received' && l.actionDetails.includes('Late Checkout'))) {
        requestType = 'Late Checkout';
      } else if (c.activityLogs.some(l => l.actionType.includes('PAYMENT'))) {
        requestType = 'Billing';
      }

      // Determine AI Action summary
      let aiAction = 'AI answered query';
      if (c.status === 'escalated') {
        aiAction = 'AI escalated request';
      } else if (c.activityLogs.some(l => l.actionType === 'BOOKING_CREATED')) {
        aiAction = 'AI processed booking';
      }

      // PMS Status summary
      let pmsStatus = 'Query resolved (No PMS update)';
      if (c.activityLogs.some(l => l.actionType === 'BOOKING_CREATED')) {
        pmsStatus = 'Reservation posted to Mews';
      } else if (c.activityLogs.some(l => l.actionType === 'BOOKING_FAILED')) {
        pmsStatus = 'Mews booking failed';
      } else if (c.activityLogs.some(l => l.actionType === 'PAYMENT_REQUEST_CREATED')) {
        pmsStatus = 'Payment request sent';
      }

      const formattedTime = new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return {
        id: c.id,
        timestamp: formattedTime,
        guest: c.guest?.name || 'Unknown Guest',
        room: c.guest?.roomNumber ? `Room ${c.guest.roomNumber}` : 'Room N/A',
        channel: formattedChannel,
        requestType,
        aiAction,
        pmsStatus,
        confidence: `${Math.round(c.confidenceScore * 100)}%`,
        finalStatus: c.status === 'escalated' ? 'Escalated' : 'Resolved',
        details: {
          guestRequest: firstRequest,
          aiReply: lastResponse,
          pmsUpdate: c.activityLogs.filter(l => l.actionType.includes('BOOKING') || l.actionType.includes('PAYMENT')).map(l => l.actionDetails).join('; ') || 'No PMS mutations performed.',
          escalationReason: escalationLog ? escalationLog.actionDetails : ''
        }
      };
    });

    res.status(200).json({
      success: true,
      data: formattedLogs
    });
  } catch (error) {
    console.error('Failed to retrieve activity logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve activity logs from database'
    });
  }
};

module.exports = {
  getActivityLogs
};
