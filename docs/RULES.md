# DEVELOPMENT RULES

# Backend Rules

- Use Node.js + Express only
- Use Prisma ORM only
- Use PostgreSQL only
- Use async/await only
- No business logic in routes
- Keep services modular
- Follow MVC architecture

---

# API Rules

- REST API only
- JSON responses only
- Proper HTTP status codes
- Validate all request bodies

---

# Database Rules

- snake_case columns
- lowercase table names
- timestamps in all tables

---

# Code Rules

- reusable services
- avoid duplicate logic
- proper error handling
- centralized logger

---

# AI Rules

- AI cannot directly update PMS
- Validation required before PMS updates
- AI confidence score mandatory
- Escalation threshold configurable

---

# Security Rules

- JWT authentication required
- Passwords hashed with bcrypt
- Environment variables mandatory
- No API keys hardcoded

---

# Integration Rules

- All third-party APIs isolated in integrations/
- Retry handling required
- Timeout handling required

---

# Project Rules

- Do not overwrite existing modules
- Do not generate unnecessary files
- Keep naming consistent
- Maintain scalable structure