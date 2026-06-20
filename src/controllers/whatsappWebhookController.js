const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const automationEngine = require('../services/AutomationEngine');
const crypto = require('crypto');

/**
 * Validates the WhatsApp webhook payload signature
 */
const verifySignature = (req, secret) => {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !secret) return false;

  // Use raw body for correct HMAC (re-serialized JSON can differ from original bytes)
  const payload = req.rawBody || JSON.stringify(req.body);
  const expectedSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature.padEnd(expectedSignature.length)),
      Buffer.from(expectedSignature)
    );
  } catch (e) {
    console.error('[WhatsApp] Signature comparison error:', e.message);
    return false;
  }
};

/**
 * Verify Webhook (GET)
 * Used by Meta to confirm the webhook URL
 */
exports.verifyWebhook = async (req, res) => {
  const { hotelId } = req.params;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (!hotelId || !mode || !token) return res.sendStatus(400);

  try {
    const hotel = await prisma.hotel.findUnique({ where: { id: parseInt(hotelId) } });
    if (!hotel || !hotel.whatsappVerifyToken) return res.sendStatus(403);

    if (mode === 'subscribe' && token === hotel.whatsappVerifyToken) {
      console.log(`WhatsApp Webhook Verified for Hotel ID: ${hotelId}!`);
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } catch (error) {
    console.error('Error verifying webhook:', error);
    res.sendStatus(500);
  }
};

/**
 * Helper: persist WhatsApp health status to the DB so the UI can surface errors
 * status: 'ok' | 'token_invalid' | 'secret_mismatch' | 'error'
 */
const setWhatsappHealth = async (hotelId, status, note) => {
  try {
    await prisma.hotel.update({
      where: { id: parseInt(hotelId) },
      data: { whatsappHealthStatus: status, whatsappHealthNote: note }
    });
  } catch (e) {
    console.error('[WhatsApp] Failed to update health status:', e.message);
  }
};

/**
 * Handle Incoming Messages (POST)
 */
exports.handleIncoming = async (req, res) => {
  const { hotelId } = req.params;
  console.log(`\n[WhatsApp] ===== INCOMING WEBHOOK POST for Hotel ID: ${hotelId} =====`);
  
  try {
    const hotel = await prisma.hotel.findUnique({ where: { id: parseInt(hotelId) } });
    if (!hotel) {
      console.error(`[WhatsApp] Hotel ID ${hotelId} NOT FOUND in database`);
      return res.sendStatus(404);
    }
    console.log(`[WhatsApp] Hotel found: ${hotel.hotelName}`);

    const { decrypt } = require('../utils/cryptoUtils');
    const secret = hotel.whatsappAppSecret ? decrypt(hotel.whatsappAppSecret) : null;
    console.log(`[WhatsApp] App Secret present: ${!!secret}`);

    // 1. Verify Signature (skipped in development for easier local testing)
    if (process.env.NODE_ENV === 'production' && secret && !verifySignature(req, secret)) {
      console.error(`[WhatsApp] ❌ Signature Verification FAILED for Hotel ID ${hotelId}.`);
      await setWhatsappHealth(hotelId, 'secret_mismatch', 'App Secret mismatch — please re-enter your App Secret from Meta Developer Console → App Settings → Basic.');
      return res.sendStatus(401);
    }
    if (process.env.NODE_ENV !== 'production' && secret && !verifySignature(req, secret)) {
      console.warn(`[WhatsApp] ⚠️ Signature mismatch (DEV MODE - continuing anyway). Fix App Secret before going live.`);
      await setWhatsappHealth(hotelId, 'secret_mismatch', 'App Secret mismatch — please re-enter your App Secret from Meta Developer Console → App Settings → Basic.');
    } else if (hotel.whatsappHealthStatus === 'secret_mismatch') {
      await setWhatsappHealth(hotelId, 'ok', null);
    }
    console.log(`[WhatsApp] ✅ Proceeding`);

    const body = req.body;
    console.log(`[WhatsApp] Body object type: ${body?.object}`);

    // Simple in-memory de-duplication cache
    if (!global.whatsappProcessedMessageIds) {
      global.whatsappProcessedMessageIds = new Set();
    }

    if (body.object === 'whatsapp_business_account') {
      res.status(200).send('EVENT_RECEIVED'); // Acknowledge Meta quickly to prevent retries
      console.log(`[WhatsApp] ✅ Acknowledged META with 200 OK`);

      for (const entry of body.entry) {
        for (const change of entry.changes) {
          console.log(`[WhatsApp] Change field: ${change.field}`);
          if (change.value && change.value.messages) {
            const phoneNumberId = change.value.metadata?.phone_number_id;
            const message = change.value.messages[0];
            const messageId = message?.id;
            console.log(`[WhatsApp] 📱 Phone Number ID from Meta: ${phoneNumberId}`);
            console.log(`[WhatsApp] 💬 Message type: ${message?.type}`);

            if (messageId) {
              if (global.whatsappProcessedMessageIds.has(messageId)) {
                console.log(`[WhatsApp] ⚠️ Duplicate message ignored: ${messageId}`);
                continue;
              }
              global.whatsappProcessedMessageIds.add(messageId);
              if (global.whatsappProcessedMessageIds.size > 10000) {
                const firstVal = global.whatsappProcessedMessageIds.values().next().value;
                global.whatsappProcessedMessageIds.delete(firstVal);
              }
            }

            const senderIdentity = message.from;
            const textContent = message.text ? message.text.body : null;
            console.log(`[WhatsApp] 👤 Sender: ${senderIdentity}, Text: "${textContent}"`);

            if (!textContent) {
              console.log(`[WhatsApp] ⚠️ Non-text message skipped (type: ${message?.type})`);
              continue;
            }

            try {
              // Find which hotel this phone number ID belongs to
              const matchedHotel = await prisma.hotel.findFirst({
                where: { whatsappPhoneId: phoneNumberId }
              });

              if (!matchedHotel) {
                console.error(`[WhatsApp] ❌ No hotel found with whatsappPhoneId = "${phoneNumberId}"`);
                console.error(`[WhatsApp] ⚠️ Make sure the Phone Number ID in PMS Settings matches this value exactly!`);
                continue;
              }

              console.log(`[WhatsApp] ✅ Message routed to Hotel: ${matchedHotel.hotelName} (ID: ${matchedHotel.id})`);
              
              // Fire and forget — already responded 200 to Meta
              automationEngine.handleIncomingMessage(matchedHotel.id, senderIdentity, textContent, 'WhatsApp')
                .catch(err => console.error('[WhatsApp] AutomationEngine error:', err.message));

            } catch (error) {
              console.error('[WhatsApp] Error processing message:', error);
            }
          } else {
            console.log(`[WhatsApp] ℹ️ No messages in this change payload (may be a status update)`);
          }
        }
      }
    } else {
      console.log(`[WhatsApp] ℹ️ Unhandled object type: ${body?.object}`);
      res.sendStatus(200);
    }
  } catch (error) {
    console.error('[WhatsApp] Critical error in handleIncoming:', error);
    res.sendStatus(500);
  }
};
