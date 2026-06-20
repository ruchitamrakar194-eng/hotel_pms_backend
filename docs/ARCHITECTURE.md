# BACKEND ARCHITECTURE

## Stack

- Node.js
- Express.js
- Prisma ORM
- PostgreSQL
- OpenAI API
- WhatsApp API
- JWT Authentication

---

# Architecture Pattern

MVC + Service Layer

---

# Folder Structure

backend/
│
├── src/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── prisma/
│   ├── flows/
│   ├── integrations/
│   ├── utils/
│   ├── config/
│   └── app.js

---

# Rules

- Routes should contain NO business logic
- Controllers only handle request/response
- Services contain business logic
- Prisma queries only inside services
- Integrations isolated separately
- Async/await only
- Use centralized error handling

---

# Core Modules

## Conversation Module
Handles:
- guest messages
- AI replies
- human takeover
- message history

---

## AI Engine Module
Handles:
- OpenAI requests
- prompt generation
- confidence scoring
- escalation detection

---

## PMS Integration Module
Handles:
- guest lookup
- folio updates
- reservation data
- occupancy checks

---

## Automation Module
Handles:
- workflow execution
- automation rules
- trigger engine

---

## Knowledge Base Module
Handles:
- document indexing
- retrieval search
- policy matching

---

# API Architecture

Frontend → Express API → Services → Integrations/APIs

---

# Authentication

JWT based authentication.

Roles:
- admin
- operator

---

# Error Handling

Centralized middleware:
- validation errors
- integration failures
- AI failures
- PMS sync failures

---

# Logging

Store:
- API logs
- AI actions
- PMS actions
- escalation logs

---

# Deployment

Frontend:
- Netlify

Backend:
- Railway / Render / VPS

Database:
- PostgreSQL