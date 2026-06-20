# AUTOPILOT AI ORCHESTRATION PLATFORM

## Project Overview

AutoPilot is an AI-powered hotel communication orchestration platform.

The system automates hotel guest communication using:
- WhatsApp
- Email
- PMS integrations
- AI decision engine
- Knowledge base retrieval

This is NOT a Property Management System (PMS).

This platform works as an AI middleware layer between:
Guest ↔ AI Engine ↔ PMS ↔ Hotel Staff

---

# Core Objective

Automate repetitive guest communication while maintaining:
- hotel policy compliance
- escalation safeguards
- PMS synchronization
- human takeover support

---

# User Roles

## 1. Admin
Platform owner.

Permissions:
- Manage hotel onboarding
- Configure integrations
- Monitor AI infrastructure
- Billing management
- Platform settings

---

## 2. Hotel Operator
Front desk / hotel staff.

Permissions:
- Monitor conversations
- Takeover AI chats
- Review escalations
- Configure automations
- Manage knowledge base

---

## 3. AI Engine
System automation layer.

Responsibilities:
- Understand guest messages
- Retrieve PMS data
- Validate hotel policies
- Generate responses
- Trigger escalations
- Sync folio updates

---

# MVP Features

## Conversations
- AI guest messaging
- Human takeover
- AI confidence tracking
- WhatsApp support
- Chat timeline

---

## Automation Engine
- Late checkout automation
- Spa booking automation
- Billing dispute automation
- Escalation rules
- Confidence thresholds

---

## Knowledge Base
- SOP upload
- Policy indexing
- RAG retrieval
- AI retrieval simulation

---

## Revenue Automation
- Automated upsells
- PMS folio posting
- Service revenue logs

---

## Activity Logs
- Guest interaction history
- AI actions
- PMS updates
- Escalation logs

---

## Settings
- AI tone configuration
- Threshold rules
- Notification settings
- Billing management

---

# Business Logic

## Late Checkout Flow
1. Guest requests late checkout
2. AI checks PMS occupancy
3. AI checks guest loyalty tier
4. AI checks hotel policy
5. AI generates response
6. PMS folio updated
7. Confirmation sent

---

## Escalation Rules

Escalate if:
- AI confidence < threshold
- Refund request exceeds limit
- Occupancy exceeds threshold
- VIP guest requests manual support
- Guest sentiment is negative

---

## Human Takeover

Operator can:
- join conversation
- pause AI
- return conversation to AI

---

# Future Features

- Voice AI
- Multi-property management
- Analytics dashboard
- AI training feedback
- Multi-language AI
- Stripe integration
- Real-time occupancy sync