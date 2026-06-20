const prisma = require('../config/prisma');

/**
 * Conversation Service
 * Handles persistence of messages and conversation states
 */
class ConversationService {
  async findOrCreateConversation(guestId) {
    let conversation = await prisma.conversation.findFirst({
      where: { 
        guestId,
        status: { in: ['active', 'escalated'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { guestId }
      });
    }

    return conversation;
  }

  async getRecentMessages(conversationId, limit = 10) {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return messages.reverse(); // Chronological order
  }

  async addMessage(conversationId, senderType, content, channel = 'WhatsApp', toolCalls = null, toolCallId = null, emailMessageId = null, emailInReplyTo = null) {
    const data = {
      conversationId,
      senderType,
      content: content || "",
      channel
    };
    if (toolCalls) data.toolCalls = toolCalls;
    if (toolCallId) data.toolCallId = toolCallId;
    if (emailMessageId) data.emailMessageId = emailMessageId;
    if (emailInReplyTo) data.emailInReplyTo = emailInReplyTo;

    const message = await prisma.message.create({ data });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessage: content || "Tool execution in progress..." }
    });

    return message;
  }

  async updateStatus(conversationId, status, confidenceScore = 1.0) {
    return prisma.conversation.update({
      where: { id: conversationId },
      data: { status, confidenceScore }
    });
  }

  async logActivity(conversationId, actionType, actionDetails) {
    return prisma.activityLog.create({
      data: {
        conversationId,
        actionType,
        actionDetails
      }
    });
  }
}

module.exports = new ConversationService();
