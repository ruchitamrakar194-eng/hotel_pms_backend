const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class ImapService {
  constructor() {
    this.connections = new Map(); // hotelId -> ImapFlow instance
    this.connectionAttempts = new Map(); // hotelId -> number of attempts
    this.connectionStats = new Map(); // hotelId -> { connectedSince, lastProcessed, lastError, lastReconnect }
    this.shuttingDown = false;
  }

  // Generate deterministic hash for deduplication fallback
  generateHash(sender, subject, date) {
    return crypto
      .createHash('sha256')
      .update(`${sender}|${subject}|${date}`)
      .digest('hex');
  }

  getStats(hotelId) {
    return this.connectionStats.get(hotelId) || { status: 'Disconnected' };
  }

  updateStats(hotelId, updates) {
    const current = this.getStats(hotelId);
    this.connectionStats.set(hotelId, { ...current, ...updates });
  }

  // Gracefully close all connections on shutdown
  async shutdown() {
    this.shuttingDown = true;
    console.log('[IMAP] Shutting down all connections...');
    for (const [hotelId, client] of this.connections.entries()) {
      try {
        await client.logout();
        console.log(`[IMAP] Logged out successfully for Hotel ${hotelId}`);
      } catch (err) {
        console.error(`[IMAP] Error logging out Hotel ${hotelId}:`, err);
      }
    }
    this.connections.clear();
  }

  // Exponential backoff delay
  getBackoffDelay(attempts) {
    const delays = [5000, 10000, 30000, 60000]; // 5s, 10s, 30s, 60s
    return delays[Math.min(attempts, delays.length - 1)];
  }

  async startListener(hotel) {
    if (this.shuttingDown) return;
    if (this.connections.has(hotel.id)) {
      console.log(`[IMAP] Listener already running for Hotel ${hotel.id}`);
      return;
    }

    const { decrypt } = require('../utils/cryptoUtils');
    let decryptedPassword;
    try {
      decryptedPassword = decrypt(hotel.imapPass);
    } catch (err) {
      console.error(`[IMAP] Failed to decrypt IMAP password for Hotel ${hotel.id}:`, err);
      this.updateStats(hotel.id, { status: 'Failed', lastError: 'Password Decryption Failed' });
      return;
    }

    const client = new ImapFlow({
      host: hotel.imapHost,
      port: hotel.imapPort || 993,
      secure: hotel.imapTls !== false,
      auth: {
        user: hotel.imapUser,
        pass: decryptedPassword
      },
      logger: false // Set to true for verbose imapflow logs
    });

    // Attach event listeners BEFORE connecting to catch any early disconnects or errors
    client.on('close', () => {
      console.log(`[IMAP] Connection closed for Hotel ${hotel.id}`);
      this.connections.delete(hotel.id);
      this.updateStats(hotel.id, { status: 'Disconnected' });
      if (!this.shuttingDown) {
        this.scheduleReconnect(hotel);
      }
    });

    client.on('error', (err) => {
      console.error(`[IMAP] Connection error for Hotel ${hotel.id}:`, err);
      this.updateStats(hotel.id, { status: 'Error', lastError: err.message });
    });

    this.connections.set(hotel.id, client);
    this.updateStats(hotel.id, { status: 'Connecting...' });

    try {
      await client.connect();
      console.log(`[IMAP] Connected for Hotel ${hotel.id}`);
      this.connectionAttempts.set(hotel.id, 0); // Reset attempts on success
      this.updateStats(hotel.id, { 
        status: 'Connected', 
        connectedSince: new Date().toISOString(),
        lastError: null 
      });

      // Explicitly select INBOX
      let mailbox = await client.mailboxOpen('INBOX');

      // 1. Recover unread emails from downtime before live listening
      await this.recoverUnreadEmails(hotel, client);

      // 2. Start listening for new emails (Poll every 15 seconds)
      const pollMailbox = async () => {
        if (this.shuttingDown || this.connections.get(hotel.id) !== client) return;
        try {
          console.log(`[IMAP] Polling mailbox for Hotel ${hotel.id}...`);
          // Send a NOOP to keep connection alive and check for updates
          await client.noop();
          await this.handleNewEmails(hotel, client);
        } catch (err) {
          console.warn(`[IMAP] Polling error for Hotel ${hotel.id}:`, err.message);
        }
        setTimeout(pollMailbox, 15000);
      };
      
      // Start the polling loop
      setTimeout(pollMailbox, 15000);



    } catch (err) {
      console.error(`[IMAP] Failed to connect for Hotel ${hotel.id}:`, err);
      this.connections.delete(hotel.id);
      this.updateStats(hotel.id, { status: 'Failed', lastError: err.message });
      this.scheduleReconnect(hotel);
    }
  }

  scheduleReconnect(hotel) {
    if (this.shuttingDown) return;
    const attempts = this.connectionAttempts.get(hotel.id) || 0;
    const delay = this.getBackoffDelay(attempts);
    
    console.log(`[IMAP] Reconnecting Hotel ${hotel.id} in ${delay/1000}s (Attempt ${attempts + 1})...`);
    this.connectionAttempts.set(hotel.id, attempts + 1);
    this.updateStats(hotel.id, { 
      status: 'Reconnecting...', 
      lastReconnect: new Date().toISOString() 
    });

    setTimeout(() => {
      this.startListener(hotel);
    }, delay);
  }

  async recoverUnreadEmails(hotel, client) {
    try {
      console.log(`[IMAP] Checking for unread emails for Hotel ${hotel.id}...`);
      
      // Step 1: Get all unseen UIDs first (fast, prevents socket timeout)
      let uids = [];
      for await (let msg of client.fetch({ seen: false }, { uid: true })) {
        uids.push(msg.uid);
      }
      
      console.log(`[IMAP] Found ${uids.length} unseen emails for Hotel ${hotel.id}`);

      // Only process the last 20 to clear backlog quickly and catch new emails
      if (uids.length > 20) {
        uids = uids.slice(-20);
      }

      // Step 2: Fetch and process them one by one
      for (let uid of uids) {
        try {
          let fetchedMsg = null;
          for await (let msg of client.fetch(uid, { source: { maxSize: 5000000 }, uid: true, envelope: true }, { uid: true })) {
            fetchedMsg = msg;
          }
          if (fetchedMsg) {
            await this.processMessage(hotel, client, fetchedMsg);
          }
        } catch (fetchErr) {
          console.error(`[IMAP] Failed to fetch UID ${uid}:`, fetchErr.message);
        }
      }
    } catch (err) {
      console.error(`[IMAP] Error recovering unread emails for Hotel ${hotel.id}:`, err);
    }
  }

  async handleNewEmails(hotel, client) {
    try {
      // Step 1: Get all unseen UIDs first
      const uids = [];
      for await (let msg of client.fetch({ seen: false }, { uid: true })) {
        uids.push(msg.uid);
      }
      
      // Step 2: Fetch and process one by one
      for (let uid of uids) {
        try {
          let fetchedMsg = null;
          for await (let msg of client.fetch(uid, { source: { maxSize: 5000000 }, uid: true, envelope: true }, { uid: true })) {
            fetchedMsg = msg;
          }
          if (fetchedMsg) {
            await this.processMessage(hotel, client, fetchedMsg);
          }
        } catch (fetchErr) {
          console.error(`[IMAP] Failed to fetch UID ${uid}:`, fetchErr.message);
        }
      }
    } catch (err) {
      console.error(`[IMAP] Error handling new emails for Hotel ${hotel.id}:`, err);
    }
  }

  async processMessage(hotel, client, msg) {
    try {
      if (!msg.source) {
         console.error(`[IMAP] Message source too large or unavailable for uid ${msg.uid}`);
         return;
      }
      
      const parsed = await simpleParser(msg.source);
      
      // 1. Loop Prevention (CRITICAL)
      // Check sender matches hotel's SMTP user
      const senderEmail = parsed.from?.value[0]?.address;
      if (senderEmail && hotel.smtpUser && senderEmail.toLowerCase() === hotel.smtpUser.toLowerCase()) {
        console.log(`[IMAP] Ignored Loop: Sender matches hotel email (${senderEmail})`);
        await client.messageFlagsAdd(msg.uid.toString(), ['\\Seen'], { uid: true });
        return; 
      }
      // Check for custom header
      if (parsed.headers.has('x-autopilot-processed')) {
        console.log(`[IMAP] Ignored Loop: X-AutoPilot-Processed header found`);
        return;
      }

      // 2. Deduplication Strategy
      const messageId = parsed.messageId;
      const uid = msg.uid?.toString();
      const hash = this.generateHash(senderEmail, parsed.subject, parsed.date?.toISOString());
      
      let identifierType, identifierValue;
      if (messageId) {
        identifierType = 'MESSAGE_ID';
        identifierValue = messageId;
      } else if (uid) {
        identifierType = 'UID';
        identifierValue = uid;
      } else {
        identifierType = 'HASH';
        identifierValue = hash;
      }

      // 3. Duplicate Check
      const existing = await prisma.processedEmail.findUnique({
        where: {
          hotelId_identifier: {
            hotelId: hotel.id,
            identifier: identifierValue
          }
        }
      });

      if (existing) {
        console.log(`[IMAP] Skipped Duplicate: ${identifierType} ${identifierValue}`);
        await client.messageFlagsAdd(msg.uid.toString(), ['\\Seen'], { uid: true });
        return;
      }

      // 4. Process AutomationEngine (Retry Logic)
      console.log(`[IMAP] Processing Email from ${senderEmail} (Subject: ${parsed.subject})`);
      const payload = {
        hotelId: hotel.id,
        sender: senderEmail,
        subject: parsed.subject,
        text: parsed.text,
        messageId: messageId,
        date: parsed.date,
        inReplyTo: parsed.inReplyTo,
        references: parsed.references,
        isImap: true
      };

      // Import inside function to avoid circular dependencies if any
      const AutomationEngine = require('./AutomationEngine');
      
      let success = false;
      let attempts = 0;
      const maxRetries = 3;

      while (attempts < maxRetries && !success) {
        attempts++;
        try {
          // Assuming AutomationEngine has a processEmail or similar entrypoint.
          await AutomationEngine.handleIncomingMessage(
            hotel.id,
            senderEmail,
            parsed.text || parsed.html || '', // Content
            'Email',
            messageId,
            parsed.inReplyTo || parsed.references // Just pass what we have
          );
          success = true;
        } catch (procErr) {
          console.error(`[IMAP] Process Attempt ${attempts} failed for Hotel ${hotel.id}:`, procErr.message);
          if (attempts >= maxRetries) {
            console.error(`[IMAP] Permanent failure processing email ${identifierValue}`);
            // Don't save to ProcessedEmail, don't mark as seen.
            return; 
          }
          await new Promise(res => setTimeout(res, 2000)); // wait 2s before retry
        }
      }

      // 5. Save ID to DB (Completion Record)
      await prisma.processedEmail.create({
        data: {
          hotelId: hotel.id,
          identifierType,
          identifier: identifierValue
        }
      });

      // 6. Mark as Seen
      await client.messageFlagsAdd(msg.uid.toString(), ['\\Seen'], { uid: true });
      console.log(`[IMAP] Successfully processed and marked as seen: ${identifierValue}`);

      this.updateStats(hotel.id, { lastProcessed: new Date().toISOString() });

    } catch (err) {
      console.error(`[IMAP] Global error processing message for Hotel ${hotel.id}:`, err);
    }
  }
}

module.exports = new ImapService();
// trigger restart
