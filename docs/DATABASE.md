# DATABASE DESIGN

## ORM
Prisma ORM

## Database
MySQL

## Local Development
XAMPP MySQL Server

---

# Database Configuration

## Local Environment

XAMPP MySQL:
- Host: localhost
- Port: 3306
- Username: root
- Password: (empty by default)

---

# Prisma Connection URL

.env

DATABASE_URL="mysql://root:@localhost:3306/autopilot_ai"

---

# Naming Rules

- lowercase tables
- snake_case columns
- plural table names

---

# Tables

## users

Fields:
- id
- name
- email
- password
- role
- created_at

Roles:
- admin
- operator

---

## guests

Fields:
- id
- name
- phone
- email
- loyalty_tier
- room_number
- pms_guest_id
- created_at

---

## conversations

Fields:
- id
- guest_id
- status
- ai_enabled
- confidence_score
- created_at

Status:
- active
- escalated
- resolved

---

## messages

Fields:
- id
- conversation_id
- sender_type
- message
- created_at

Sender Types:
- guest
- ai
- operator

---

## automations

Fields:
- id
- name
- status
- trigger_type
- confidence_threshold
- created_at

Status:
- active
- paused
- disabled

---

## activity_logs

Fields:
- id
- conversation_id
- action_type
- action_details
- created_at

---

## knowledge_documents

Fields:
- id
- title
- category
- content
- status
- created_at

Status:
- indexed
- processing
- failed

---

## revenue_logs

Fields:
- id
- guest_id
- service_type
- amount
- folio_status
- created_at

Status:
- paid
- pending
- failed

---

# Relationships

guests
→ conversations
→ messages

conversations
→ activity_logs

guests
→ revenue_logs

---

# Prisma Migration Commands

## Initialize Prisma

npm install prisma @prisma/client

npx prisma init

---

## Create Migration

npx prisma migrate dev --name init

---

## Generate Prisma Client

npx prisma generate

---

# XAMPP Setup

## Steps

1. Install XAMPP
2. Start Apache
3. Start MySQL
4. Open phpMyAdmin
5. Create database:

autopilot_ai

---

# Development Notes

- Use phpMyAdmin for easy database management
- Prisma handles schema migrations
- MySQL suitable for local MVP development
- Easy deployment later on VPS/Cloud MySQL

---

# Future Upgrade

Production can later move to:
- Railway MySQL
- PlanetScale
- AWS RDS
- DigitalOcean Managed DB   