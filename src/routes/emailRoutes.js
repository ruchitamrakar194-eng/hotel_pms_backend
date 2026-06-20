const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const automationEngine = require('../services/AutomationEngine');
const conversationService = require('../services/conversationService');

/**
 * Trim quoted email replies (Outlook/Gmail/Apple Mail thread cutoff)
 */
function stripQuotedReply(text) {
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  const cleanedLines = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      line.match(/^[>\s]*On\s+.*\s+wrote:/i) ||
      line.match(/^[>\s]*From:\s+.*/i) ||
      line.match(/^[>\s]*-----Original Message-----/i) ||
      line.match(/^[>\s]*--- Original Message ---/i) ||
      line.match(/^[>\s]*________________________________/) ||
      trimmed.startsWith('>')
    ) {
      break; // Stop collecting lines at thread cutoff point
    }
    cleanedLines.push(line);
  }
  
  return cleanedLines.join('\n').trim();
}

/**
 * Strip common email signature patterns
 */
function stripSignatures(text) {
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  const cleanedLines = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed === '--' ||
      trimmed === '---' ||
      trimmed.toLowerCase() === 'thanks,' ||
      trimmed.toLowerCase() === 'thanks and regards,' ||
      trimmed.toLowerCase() === 'best regards,' ||
      trimmed.toLowerCase() === 'kind regards,' ||
      trimmed.toLowerCase() === 'sent from my iphone' ||
      trimmed.toLowerCase() === 'sent from my mail'
    ) {
      break; // Stop collecting lines at signature block
    }
    cleanedLines.push(line);
  }
  return cleanedLines.join('\n').trim();
}

/**
 * Parse forwarded messages and identify low-confidence forwards
 */
function parseForwardedEmail(text) {
  if (!text) return { content: "", isForward: false, lowConfidence: false };
  
  const hasForwardMarker = text.match(/Forwarded message/i) || text.match(/Begin forwarded message/i);
  if (!hasForwardMarker) {
    return { content: text, isForward: false, lowConfidence: false };
  }
  
  const lines = text.split(/\r?\n/);
  const topLines = [];
  
  for (const line of lines) {
    if (line.match(/Forwarded message/i) || line.match(/Begin forwarded message/i)) {
      break;
    }
    topLines.push(line);
  }
  
  const topContent = topLines.join('\n').trim();
  
  // If there's clear text added on top of the forward, use it
  if (topContent.length > 10) {
    return { content: topContent, isForward: true, lowConfidence: false };
  }
  
  // If there is only forwarded content without sender commentary, mark as low-confidence escalation
  return { content: text, isForward: true, lowConfidence: true };
}

/**
 * Extract clean email address from "Name <email@address.com>" formatting
 */
function extractEmailAddress(from) {
  if (!from) return "";
  const match = from.match(/<([^>]+)>/);
  if (match) {
    return match[1].trim().toLowerCase();
  }
  return from.trim().toLowerCase();
}

/**
 * Handle Inbound Guest Emails (POST)
 */
const handleIncomingEmail = async (req, res) => {
  const { hotelId } = req.params;
  
  // Extract fields with support for standard webhook providers (like CloudMailin / SendGrid)
  const rawFrom = req.body.from || (req.body.envelope && req.body.envelope.from) || (req.body.headers && req.body.headers.from);
  const fromEmail = extractEmailAddress(rawFrom);
  const emailSubject = req.body.subject || (req.body.headers && req.body.headers.subject);
  const emailMessageId = req.body.messageId || (req.body.headers && req.body.headers.message_id);
  const emailInReplyTo = req.body.inReplyTo || (req.body.headers && req.body.headers.in_reply_to);
  const emailReferences = req.body.references || (req.body.headers && req.body.headers.references);

  // 1. HTML Fallback
  let emailContent = req.body.text || req.body.plain;
  const rawHtml = req.body.html || req.body.html;
  if (!emailContent && rawHtml) {
    emailContent = rawHtml
      .replace(/<style([\s\S]*?)<\/style>/gi, '')
      .replace(/<script([\s\S]*?)<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (!fromEmail || !emailContent) {
    return res.status(400).json({ success: false, message: 'From and email content (text or html) are required.' });
  }

  try {
    const hotel = await prisma.hotel.findUnique({ where: { id: parseInt(hotelId) } });
    if (!hotel) return res.sendStatus(404);

    console.log(`[Email Webhook] Inbound email from ${fromEmail} received for Hotel ${hotel.id}`);

    // 2. Deduplication Fallback
    let dedupeKey = emailMessageId;
    if (!dedupeKey) {
      const timeRef = req.body.timestamp || Date.now().toString();
      const subRef = emailSubject || 'No Subject';
      const hashPayload = `${fromEmail}_${subRef}_${timeRef}`;
      dedupeKey = crypto.createHash('sha256').update(hashPayload).digest('hex');
    }

    if (!global.emailProcessedMessageIds) {
      global.emailProcessedMessageIds = new Set();
    }

    if (global.emailProcessedMessageIds.has(dedupeKey)) {
      console.log(`[Email] Duplicate email ignored: ${dedupeKey}`);
      return res.status(200).json({ success: true, message: 'Duplicate email ignored.' });
    }
    global.emailProcessedMessageIds.add(dedupeKey);
    if (global.emailProcessedMessageIds.size > 10000) {
      const firstVal = global.emailProcessedMessageIds.values().next().value;
      global.emailProcessedMessageIds.delete(firstVal);
    }

    // 3. Threading Lookup
    let matchedConversation = null;
    const targetRef = emailInReplyTo || emailReferences;
    if (targetRef) {
      const matchMsg = await prisma.message.findFirst({
        where: {
          OR: [
            { emailMessageId: targetRef },
            { emailInReplyTo: targetRef }
          ]
        },
        select: { conversationId: true }
      });
      if (matchMsg) {
        matchedConversation = await prisma.conversation.findUnique({
          where: { id: matchMsg.conversationId }
        });
        console.log(`[Email Threading] Mapped email Message-ID reference ${targetRef} to Conversation ${matchMsg.conversationId}`);
      }
    }

    if (!matchedConversation) {
      const guest = await prisma.guest.findFirst({
        where: { email: fromEmail }
      });
      if (guest) {
        matchedConversation = await prisma.conversation.findFirst({
          where: {
            guestId: guest.id,
            status: { in: ['active', 'escalated'] }
          },
          orderBy: { createdAt: 'desc' }
        });
      }
    }

    // 4. Threading & Signature Stripping
    const baseCleaned = stripQuotedReply(emailContent);
    const fullyCleaned = stripSignatures(baseCleaned);

    // 5. Forwarded Email Parsing & Escalation Safeguard
    const forwardInfo = parseForwardedEmail(fullyCleaned);

    if (forwardInfo.lowConfidence) {
      console.log(`[Email] Low confidence forward parsed. Escalating to human.`);
      let guest = await prisma.guest.findFirst({ where: { email: fromEmail } });
      if (!guest) {
        guest = await prisma.guest.create({
          data: { name: 'Unknown Guest', phone: 'No Phone', email: fromEmail, status: 'Unidentified' }
        });
      }
      const conversation = await conversationService.findOrCreateConversation(guest.id);
      
      await conversationService.addMessage(conversation.id, 'guest', emailContent, 'Email', null, null, emailMessageId, targetRef);
      await conversationService.updateStatus(conversation.id, 'escalated', 0.1);
      await conversationService.logActivity(conversation.id, 'Escalation', 'Low confidence forwarded email parsed.');
      
      return res.status(200).json({ success: true, message: 'Email escalated to human operator.' });
    }

    // 6. Process via Automation Engine
    automationEngine.handleIncomingMessage(hotel.id, fromEmail, forwardInfo.content, 'Email', emailMessageId, targetRef);

    res.status(200).json({ success: true, message: 'Email received and queued for processing.' });
  } catch (error) {
    console.error('Error processing inbound email webhook:', error);
    res.sendStatus(500);
  }
};

router.post('/:hotelId', handleIncomingEmail);

module.exports = router;
