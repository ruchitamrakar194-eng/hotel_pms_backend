const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/responseHandler');
const conversationService = require('../services/conversationService');
const whatsappService = require('../services/whatsappService');

// GET /api/conversations?status=...
exports.getConversations = asyncHandler(async (req, res) => {
  const statusFilter = req.query.status;
  
  const whereClause = {};
  if (statusFilter && statusFilter !== 'ALL') {
    whereClause.status = statusFilter;
  }

  const conversations = await prisma.conversation.findMany({
    where: whereClause,
    include: {
      guest: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  const formattedConvs = conversations.map(c => {
    // Attempt to calculate waiting duration
    const now = new Date();
    const updated = new Date(c.updatedAt);
    const diffMins = Math.floor((now - updated) / 60000);
    let timeStr = 'Just now';
    if (diffMins > 60) timeStr = `${Math.floor(diffMins/60)}h ago`;
    else if (diffMins > 0) timeStr = `${diffMins}m ago`;

    // Guess channel from last message, default to whatsapp
    const channel = c.messages.length > 0 ? c.messages[0].channel : 'whatsapp';

    return {
      id: c.id,
      guestName: c.guest?.name,
      lastMessage: c.lastMessage,
      waitingDuration: timeStr,
      status: c.status,
      channel: channel,
      roomNumber: c.guest?.roomNumber,
      loyaltyTier: c.guest?.loyaltyTier,
      checkoutDate: null // We don't have this in Guest model directly, but UI handles null gracefully
    };
  });

  sendSuccess(res, 200, formattedConvs);
});

// GET /api/conversations/:id/messages
exports.getMessages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const messages = await conversationService.getRecentMessages(parseInt(id), 50);
  res.status(200).json({ success: true, messages });
});

// POST /api/conversations/:id/human-reply
exports.humanReply = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  if (!text) return res.status(400).json({ success: false, message: 'Text is required' });

  const conv = await prisma.conversation.findUnique({
    where: { id: parseInt(id) },
    include: { guest: true }
  });

  if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });

  // 1. Save message to DB
  const message = await conversationService.addMessage(conv.id, 'human', text, 'WhatsApp');
  
  // 2. Set mode to HUMAN (escalated or active with human operator)
  if (conv.status === 'active') {
    await conversationService.updateStatus(conv.id, 'escalated', 1.0);
  }

  // 3. Dispatch to WhatsApp via WhatsApp Service
  try {
    // Multi-tenant: getting hotel ID. The easiest is finding the hotel this guest belongs to.
    // If not directly linked, fetch active hotel.
    const hotel = await prisma.hotel.findFirst();
    if (hotel && conv.guest?.phone) {
      await whatsappService.sendMessage(hotel.id, conv.guest.phone, text);
    }
  } catch (err) {
    console.error('WhatsApp Dispatch Failed from Human Reply:', err.message);
    // We still return success since it's saved in DB
  }

  res.status(200).json({ success: true, message });
});

// PUT /api/conversations/:id/return-to-ai
exports.returnToAi = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const conv = await prisma.conversation.findUnique({ where: { id: parseInt(id) } });

  if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });

  // Update status back to active to let AI take over
  await conversationService.updateStatus(conv.id, 'active', 1.0);
  
  // Log event
  await conversationService.logActivity(conv.id, 'Returned to AI', 'Operator manually returned control to AI.');

  res.status(200).json({ success: true, message: 'Conversation returned to AI.' });
});
