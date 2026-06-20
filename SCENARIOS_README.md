# 🧪 AI Automation Test Scenarios
Run these scripts manually, one by one, to test the full AI + Mews + WhatsApp pipeline.

---

## Prerequisites
- Backend must be running: `npm run dev` inside `New folder/pms-hotels/`
- Hotel ID 13 must have valid Mews credentials in DB ✅ (already confirmed working)

---

## How to run any scenario:
```
cd "New folder/pms-hotels"
node scenario_X_name.js
```

---

## Scenarios Overview

| Script | What it tests | Mews API called |
|--------|--------------|-----------------|
| `scenario_1_ask_policy.js` | Guest asks checkout policy → AI queries knowledge base (RAG) | None (pure RAG) |
| `scenario_2_check_availability.js` | New guest checks room availability | `/resourceBlocks/getAll` |
| `scenario_3_book_room.js` | New guest gives name+email → AI creates profile + books room | `/customers/add` → `/reservations/add` |
| `scenario_4_late_checkout.js` | Existing guest asks for late checkout | `/reservations/getAll` → `/reservations/update` |
| `scenario_5_check_bill.js` | Guest asks to see their bill | `/finance/items/getAll` |
| `scenario_6_cancel_reservation.js` | Guest wants to cancel | `/reservations/getAll` → `/reservations/cancel` |
| `scenario_7_escalation.js` | Angry guest complaint → escalated to human | None (escalation flow) |
| `scenario_8_mock_webhook.js` | Full Meta WhatsApp webhook POST to your live server | Full pipeline |
| `scenario_9_check_in.js` | Guest arrives and requests check-in | `/reservations/getAll` → `/reservations/update` |

---

## What to watch in your terminal while running:
1. **Script terminal**: Shows AI final response to guest
2. **Backend terminal (npm run dev)**: Shows the full OpenAI tool call loop + Mews API raw request/response logs

---

## Notes
- Scenarios 1-7, 9 call the AutomationEngine **directly** (bypass HTTP server)
- Scenario 8 fires a real HTTP POST to `localhost:5000` mimicking Meta's WhatsApp webhook exactly
- Scenario 8 requires backend `npm run dev` to be running
- For Scenario 8, update `phone_number_id` to match what is stored in the DB for Hotel 13's `whatsappPhoneId` field
