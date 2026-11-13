# 🎓 TriLink Backend — Enterprise School Management & Proctoring API

[![NestJS](https://img.shields.io/badge/NestJS-v10-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeORM](https://img.shields.io/badge/TypeORM-0.3-FE0808?logo=typeorm&logoColor=white)](https://typeorm.io/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-v4-010101?logo=socketdotio&logoColor=white)](https://socket.io/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Swagger](https://img.shields.io/badge/Swagger-OpenAPI%203.0-85EA2D?logo=swagger&logoColor=black)](https://swagger.io/)

**TriLink Backend** is the core RESTful and WebSocket API powering the **TriLink Educational Ecosystem**. Built with **NestJS**, **TypeScript**, and **PostgreSQL**, it provides enterprise-grade infrastructure for real-time exam proctoring, AI-assisted learning, academic lifecycle management, multi-role communications, and student gamification.

---

## 📑 Table of Contents

- [Core Capabilities](#-core-capabilities)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
  - [Prerequisites](#prerequisites)
  - [Environment Setup](#environment-setup)
  - [Running with Docker Compose (Recommended)](#running-with-docker-compose-recommended)
  - [Running Standalone (Local Development)](#running-standalone-local-development)
- [Database Management & Seeding](#-database-management--seeding)
- [API Documentation & Endpoints](#-api-documentation--endpoints)
- [Real-Time WebSocket Gateway](#-real-time-websocket-gateway)
- [Directory Structure](#-directory-structure)
- [Configuration Reference](#-configuration-reference)
- [Contributing & License](#-contributing--license)

---

## 🚀 Core Capabilities

### 1. 🛡️ Live Exam Proctoring & Integrity Monitoring
- **Real-Time Proctor Dashboard**: Live status broadcasts for teachers monitoring online exams.
- **Anti-Cheat Violation Tracking**: Automated client detection for tab switching, fullscreen exit, and suspicious activity.
- **Remote Teacher Interventions**: Direct WebSocket commands for teacher warnings, time adjustments, and forced submissions.
- **Assessment Engine**: Supports MCQ, True/False, and Fill-in-the-blank questions with automated scoring and manual override.

### 2. 🏛️ Academic Structure & Roster Management
- **Hierarchical Taxonomy**: Academic Years, Semesters/Terms, Grades, Sections, and Subjects.
- **Flexible Enrolment**: Dynamic student-section assignments and class offering configurations.
- **Academic Year Rollover**: Seamless archival of terms and rollover of cohorts into next academic cycles.
- **Multi-Role User Directory**: Fine-grained access control across `ADMIN`, `TEACHER`, `STUDENT`, and `PARENT`.

### 3. 💬 Unified Communications & Real-Time Presence
- **Direct & Group Messaging**: Persistent chat channels with member management and admin controls.
- **Real-Time Features**: Typing indicators, online presence, read receipts, and reactions.
- **Broadcast Announcements**: Target announcements by audience (all school, teachers, students, parents, or specific grades).
- **Push & Email Notifications**: Multi-channel event notifications and automated weekly digests via SMTP.

### 4. 🎮 Gamification & Mastery Engine
- **Decoupled Event Architecture**: Driven by `@nestjs/event-emitter` domain events for zero-overhead triggers.
- **Progressive XP & Leveling**: XP engine tracking academic participation, assignment submissions, and exam scores.
- **Badges & Achievements**: Configurable milestone badges and login streak tracking.
- **Curriculum Topic Mastery**: Deep mapping between exam question performance and curriculum topic mastery scores.

### 5. 🤖 AI Microservice Integration
- **RAG Tutor Gateway**: Secure proxy to Python FastAPI AI Core (`trilink-ai-core`) for contextual tutoring.
- **Textbook Ingestion & Vectorization**: Automated parsing and semantic embedding of course materials.
- **AI Question Generation**: Automated draft question and quiz generation mapped to curriculum standards.

---

## 🏛 System Architecture

```text
               ┌────────────────────────────────────────────────────────┐
               │                      CLIENT LAYER                      │
               │   Next.js 16 Web Portal    │    Flutter Mobile App     │
               └───────────────────┬────────────────┬───────────────────┘
                                   │ HTTPS (REST)   │ WSS (Socket.IO)
                                   ▼                ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             TRILINK NESTJS BACKEND                               │
│  ┌──────────────────────┬──────────────────────┬──────────────────────────────┐  │
│  │     Auth & Guards    │   Realtime Gateway   │    Global Exception Filter   │  │
│  │   (JWT / RBAC / Rate)│   (/socket.io)       │    & Class Validation Pipe   │  │
│  └──────────┬───────────┴──────────┬───────────┴──────────────┬───────────────┘  │
│             │                      │                          │                  │
│  ┌──────────▼──────────────────────▼──────────────────────────▼───────────────┐  │
│  │                              FEATURE MODULES                               │  │
│  │  • Auth & Users     • School Structure  • Realtime Chat  • Gamification   │  │
│  │  • Exams & Attempts • Attendance & Mark • Grades (Scores)• Reports & Cards │  │
│  │  • Announcements    • Feedback & Audit  • Calendar       • AI Integration  │  │
│  └─────────────────────────────────┬──────────────────────────────────────────┘  │
│                                    │ TypeORM / Driver                            │
└────────────────────────────────────┼─────────────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────────┐
│  PostgreSQL 16   │       │   Redis Cache    │       │  TriLink AI Engine   │
│ (Neon / Local DB)│       │ (Pub/Sub & Rate) │       │   (FastAPI / RAG)    │
└──────────────────┘       └──────────────────┘       └──────────────────────┘
```

---

## 🛠 Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | [NestJS v10](https://nestjs.com/) | Progressive Node.js framework with modular architecture |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) | Type-safe enterprise server implementation |
| **Database** | [PostgreSQL 16](https://www.postgresql.org/) | Relational database (supports Neon Serverless & Docker) |
| **ORM** | [TypeORM 0.3](https://typeorm.io/) | Data mapper ORM with migrations and connection pooling |
| **WebSockets** | [Socket.IO 4](https://socket.io/) | Full-duplex real-time messaging, proctoring & presence |
| **Authentication** | [Passport.js / JWT](http://www.passportjs.org/) | Dual-token authentication (Access 15m, Refresh 7d) |
| **Documentation** | [Swagger / OpenAPI](https://swagger.io/) | Interactive API explorer generated from DTO decorators |
| **Event Bus** | [@nestjs/event-emitter](https://github.com/nestjs/event-emitter) | Decoupled domain event dispatching |
| **Validation** | `class-validator` & `class-transformer` | Strict schema validation on all incoming request payloads |
| **Storage Driver** | Cloudinary / S3 Driver | Media and textbook attachment management |
| **Containerization** | Docker & Compose | Multi-container reproducible runtime environments |

---

## ⚡ Quick Start

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **npm**: `v10.x+`
- **Docker & Docker Compose**: Optional but recommended for infrastructure

### Environment Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/TriLinkEdu/trilink-backend.git
   cd trilink-backend
   ```
2. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```
3. Update connection settings in `.env` (PostgreSQL credentials, JWT secrets, SMTP credentials).

---

### Running with Docker Compose (Recommended)

To run the complete stack (Postgres + Redis + NestJS API):

```bash
docker compose up --build
```

- API Base URL: `http://localhost:4000/api`
- Swagger Documentation: `http://localhost:4000/api-docs`
- Postgres Port: Host `5433` (maps internally to `5432`)

---

### Running Standalone (Local Development)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start database container only:
   ```bash
   docker compose up -d db redis
   ```

3. Run TypeORM migrations (if applicable):
   ```bash
   npm run migration:run
   ```

4. Start in watch mode:
   ```bash
   npm run start:dev
   ```

5. Production build and run:
   ```bash
   npm run build
   npm run start:prod
   ```

---

## 💾 Database Management & Seeding

The backend includes automated seeding scripts for fast environment provisioning:

### 1. Initial Admin Provisioning
Creates the initial super-admin account (`admin@trilink.edu` / `Admin@123`):
```bash
npm run seed
```

### 2. Comprehensive Demo Data Seeding
Provision a realistic academic environment with teachers, students, parent links, and class offerings:
```bash
# Seed class offerings across subjects and grades
npx ts-node -r tsconfig-paths/register src/scripts/seed-class-offerings.ts

# Seed demo teachers and linked parents
npx ts-node -r tsconfig-paths/register src/scripts/seed-teachers-parents.ts

# Seed sample students with enrollments
npx ts-node -r tsconfig-paths/register src/scripts/seed-students.ts
```

### 3. Default Credentials Reference
- **Admin**: `admin@trilink.edu` | `Admin@123`
- **Teacher**: `alemayehu.tadesse@trilink.edu` | `Teacher@123`
- **Student**: `abdulazizisa579@gmail.com` | `Student@123`
- **Parent**: `abdulazizisa980@gmail.com` | `Parent@123`

---

## 📚 API Documentation & Endpoints

When the server is running, the interactive Swagger documentation is available at:
👉 **[http://localhost:4000/api-docs](http://localhost:4000/api-docs)**

### Endpoint Categories Overview

| Route Prefix | Module | Key Operations |
| :--- | :--- | :--- |
| `/api/auth` | Authentication | Login, token refresh, password resets, admin user creation |
| `/api/users` | Users | Profile updates, avatar uploads, role-based user directory |
| `/api/academic-years` | Structure | Academic years, terms, active year designation, rollover |
| `/api/school-structure` | Structure | Grades, sections, and subjects configuration |
| `/api/class-offerings`| Academics | Teacher-course assignments, subject offerings per semester |
| `/api/enrollments` | Academics | Student enrollment in class offerings and sections |
| `/api/exams` | Assessments | Exam creation, question bank, publishing, scheduling |
| `/api/attempts` | Proctoring | Submit answers, monitor violations, force submit, release results |
| `/api/grades` | Grading | Bulk score entry, release grades, report card computation |
| `/api/attendance` | Attendance | Daily session creation, bulk student attendance marking |
| `/api/chat` | Messaging | Conversations list, message history, read status, member management |
| `/api/gamification` | Engagement | XP balance, badges list, leaderboard, mastery insights |
| `/api/announcements` | Communications | Broadcast announcements, target audience filtering |
| `/api/ai` | AI Integration | AI Tutor conversations, curriculum question generation |
| `/api/health` | Monitoring | Live application health and readiness probe |

---

## ⚡ Real-Time WebSocket Gateway

The WebSocket Gateway (`/socket.io`) operates on standard JWT handshake authentication.

### Handshake
```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:4000", {
  path: "/socket.io",
  auth: { token: "YOUR_JWT_ACCESS_TOKEN" },
  transports: ["websocket", "polling"],
});
```

### Core Events
| Event Name | Direction | Payload Description |
| :--- | :--- | :--- |
| `message:send` | Client ➔ Server | Send message to a conversation |
| `message:new` | Server ➔ Client | New incoming message event |
| `typing:start` / `stop` | Client ➔ Server | Real-time typing notification in room |
| `exam:join-monitor` | Client ➔ Server | Teacher joins live proctor room for an exam |
| `exam:violation` | Client ➔ Server | Client reports tab-switch or fullscreen exit |
| `exam:proctor-action` | Server ➔ Client | Force submit or proctor warning dispatched to student |

---

## 📁 Directory Structure

```text
trilink-backend/
├── data/                      # Local SQLite file database (optional fallback)
├── dist/                      # Compiled production JavaScript build
├── src/
│   ├── cache/                 # Redis cache manager configuration
│   ├── common/                # Shared filters, guards, interceptors, decorators
│   │   ├── decorators/        # @CurrentUser, @Roles, public route helpers
│   │   ├── filters/           # Global exception handler filter
│   │   └── guards/            # JWT authentication & role-based authorization
│   ├── config/                # Environment configuration schemas (TypeORM, App)
│   ├── database/              # Database module, TypeORM entities index, migrations
│   ├── modules/               # Domain-driven feature modules
│   │   ├── academic-years/    # Academic year & term lifecycle
│   │   ├── ai/                # External AI service integration gateway
│   │   ├── attendance/        # Attendance sessions and student marking
│   │   ├── auth/              # JWT strategy, password hashing, authentication
│   │   ├── chat/              # Persistent chat rooms and messaging
│   │   ├── class-offerings/   # Course-teacher offerings
│   │   ├── enrollments/       # Student enrollments
│   │   ├── exams/             # Exam bank, attempts, proctoring & violations
│   │   ├── gamification/      # XP, badges, streaks, and mastery tracking
│   │   ├── grades/            # Score entries, bulk grading, releases
│   │   ├── realtime/          # Socket.IO gateway and event dispatchers
│   │   ├── report-cards/      # Comprehensive student grade report cards
│   │   ├── school-structure/  # Grades, sections, and subjects
│   │   └── users/             # User entities, profiles, credentials
│   ├── scripts/               # Administrative CLI seeding and migration scripts
│   ├── app.module.ts          # Root application module orchestrator
│   └── main.ts                # Application bootstrap entry point
├── Dockerfile                 # Production multi-stage Docker build
├── docker-compose.yml         # Container orchestration manifest
├── nest-cli.json              # NestJS CLI configuration
├── package.json               # Dependencies and build scripts
└── tsconfig.json              # TypeScript compilation settings
```

---

## ⚙️ Configuration Reference

Key variables configured in `.env`:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `4000` | Port on which the NestJS server listens |
| `API_PREFIX` | `api` | Global route prefix (e.g., `/api/...`) |
| `DATABASE_URL` | — | Full PostgreSQL connection URL (Neon / cloud) |
| `DB_HOST` / `DB_PORT` | `localhost:5433` | Discrete PostgreSQL host & port (for local Docker DB) |
| `JWT_SECRET` | — | Secret key used to sign authentication tokens |
| `JWT_ACCESS_EXPIRES` | `15m` | Lifetime of access tokens |
| `JWT_REFRESH_EXPIRES` | `7d` | Lifetime of refresh tokens |
| `AI_SERVICE_URL` | — | Endpoint for Python RAG AI Core microservice |
| `SMTP_HOST` / `SMTP_PORT`| `smtp.gmail.com:587` | Outgoing mail server for invitations & alerts |

---

## 📄 License & Ownership

Proprietary software. Developed for the **TriLink Educational Platform**. All rights reserved.
