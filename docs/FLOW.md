# SYSTEM FLOWS

# AI Conversation Flow

1. Guest sends WhatsApp message
2. Webhook receives message
3. Conversation service processes request
4. AI engine analyzes intent
5. PMS service fetches guest data
6. Knowledge base retrieves policies
7. AI generates response
8. Confidence score calculated
9. Response sent to guest

---

# Escalation Flow

Escalate if:
- confidence below threshold
- refund exceeds limit
- VIP manual request
- angry sentiment detected

Flow:
AI → Takeover Queue → Operator

---

# Late Checkout Flow

1. Guest asks for late checkout
2. AI validates reservation
3. AI checks occupancy
4. AI checks loyalty tier
5. Policy validation
6. PMS folio update
7. Confirmation response

---

# Billing Dispute Flow

1. Guest disputes charge
2. AI checks billing rules
3. If amount < threshold:
   auto resolve
4. Else:
   escalate to operator

---

# Knowledge Retrieval Flow

1. Guest query received
2. RAG retrieval triggered
3. Matching SOP searched
4. Policy extracted
5. AI response generated

---

# Human Takeover Flow

1. Operator joins conversation
2. AI pauses automation
3. Operator sends manual response
4. Operator returns chat to AI

---

# Revenue Automation Flow

1. Guest requests service
2. AI validates availability
3. PMS folio updated
4. Charge created
5. Confirmation sent