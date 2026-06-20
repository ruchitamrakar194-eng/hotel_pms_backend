# Production Integration Readiness Audit
**Project Name:** AI-powered Hotel PMS Assistant (AutoPilot Backend)
**Auditor:** Principal Integration Engineer & Email Infrastructure Architect
**Date:** June 13, 2026
**Target Environment:** Real Email Provider Integration (SendGrid / Mailgun / AWS SES)

---

## 1. PARSING & CONTENT AUDIT

### 1. MIME Email Parsing
* **Status:** **PASS**
* **Today:** The system relies on the inbound webhook provider (like SendGrid or Mailgun) to parse MIME payloads and POST structured JSON.
* **Should Happen:** The webhook controller extracts `req.body.text` directly.
* **Risk:** **LOW**. Relies on provider parsing configurations.

### 2. HTML-Only Emails
* **Status:** **FAIL**
* **Today:** The handler checks `if (!from || !text) return res.status(400)`. If a guest client sends an HTML-only email without a text payload, the request is rejected as a 400 Bad Request.
* **Should Happen:** Convert HTML to text as a fallback if the text parameter is missing.
* **Risk:** **HIGH**. Real provider integrations will fail on HTML-only clients.

### 3. Multipart Emails
* **Status:** **PASS**
* **Today:** Structured body parts (text vs HTML) are split by the provider's webhook parser.
* **Should Happen:** Webhook selects the plain text variant.
* **Risk:** **LOW**.

### 4. Client Replies (Outlook, Gmail, Apple Mail)
* **Status:** **FAIL**
* **Today:** Trailing messages and signature content are forwarded directly to OpenAI.
* **Should Happen:** Strip previous thread blockquotes (e.g., `On Jun 13, 2026, at 10:00 PM, ... wrote:`) before sending to OpenAI.
* **Risk:** **HIGH**. Long threads will cause token bloat and confuse the LLM.

### 5. Forwarded Messages
* **Status:** **RISK**
* **Today:** Forwarded email content remains unparsed, passing the entire forward chain to the LLM.
* **Should Happen:** Parse and isolate the top message block.
* **Risk:** **MEDIUM**.

### 6. Quoted Replies
* **Status:** **FAIL**
* **Today:** Blockquotes are not trimmed.
* **Should Happen:** Apply regex to cut off the email body after lines starting with `>` or `From:`.
* **Risk:** **HIGH**.

### 7. Email Signatures
* **Status:** **RISK**
* **Today:** Signatures are sent directly to the LLM.
* **Should Happen:** Apply signature stripping utilities (e.g., cutting off after `--` dividers).
* **Risk:** **MEDIUM** (LLM token inflation).

### 8. Large Email Bodies
* **Status:** **PASS**
* **Today:** Express is configured with `app.use(express.json({ limit: '10mb' }))` which prevents payload rejection.
* **Should Happen:** Retain large body limit.
* **Risk:** **LOW**.

---

## 2. EMAIL HEADERS & THREADING

### 9. Missing Message-ID / In-Reply-To / References
* **Status:** **PASS**
* **Today:** Falls back gracefully to matching the guest's email address.
* **Should Happen:** Log activity and map to the most recent active conversation.
* **Risk:** **LOW**.

---

## 3. PRODUCER RESILIENCE & CONTENT COMPATIBILITY

### 10. Duplicate Email Delivery & Webhook Retries
* **Status:** **RISK**
* **Today:** Deduplication uses the `message.id` header. If a provider retries due to a timeout but the payload lacks a `Message-ID`, deduplication fails.
* **Should Happen:** Generate a hash based on `from + subject + timestamp` as a fallback deduplication key.
* **Risk:** **MEDIUM**.

### 11. Unicode, Emojis, and Non-English Content
* **Status:** **PASS**
* **Today:** MySQL/Prisma supports UTF-8 characters. OpenAI handles translations.
* **Should Happen:** Safe storage and processing.
* **Risk:** **LOW**.

### 12. Attachment Metadata & Malformed Payloads
* **Status:** **PASS**
* **Today:** Webhook ignores attachment payloads and catches JSON parsing errors.
* **Should Happen:** Graceful error handling.
* **Risk:** **LOW**.

---

## 4. REPORT CARD

* **Production Integration Score:** **68 / 100**
* **Verdict:** **NO-GO (Launch Blocked)**

### Action Items to Unblock:
1. **Thread Stripper:** Add a parser utility to clean client signatures and trailing quote threads (Outlook/Gmail/Apple Mail).
2. **HTML Fallback:** If `req.body.text` is empty, extract text from `req.body.html`.

### Safe to Connect?
* **Gmail API:** **No-Go** (Requires reply thread stripping).
* **SendGrid / Mailgun / Postmark / AWS SES:** **No-Go** (HTML-only emails will trigger 400 errors; quoted replies will cause context bloat).
