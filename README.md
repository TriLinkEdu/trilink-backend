# 🚀 TriLink Backend: Advanced School Management API

TriLink Backend is a robust, high-performance **NestJS** API designed for modern educational institutions. It powers the TriLink ecosystem with real-time proctoring, secure academic management, and unified communications.

---

## 🛠 Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) (TypeScript)
- **Database**: PostgreSQL (via TypeORM)
- **Real-Time**: Socket.io (WebSockets)
- **Security**: JWT (Access + Refresh Tokens)
- **Documentation**: Swagger UI
- **Infrastructure**: Docker & Docker Compose

---

## ⚡ Quick Start

### 1. Prerequisites
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)
- [Node.js](https://nodejs.org/) v18+ (for local development)

### 2. Clone & Environment
```bash
git clone https://github.com/TriLinkEdu/trilink-backend.git
cd trilink-backend
cp .env.example .env
```
*Note: Default values in `.env.example` are pre-configured for the Docker setup.*

### 3. Launch with Docker (Recommended)
```bash
docker compose up --build
```
The API will be available at `http://localhost:4000/api`.

### 4. Seed Initial Data
To create the default admin account (`admin@trilink.edu` / `Admin@123`):
```bash
docker compose --profile seed run --rm seed
```

---

## 🛡 Key Features

### 🏢 Academic Management
- **Hierarchical Structure**: Manage Academic Years, Grades, Sections, and Subjects.
- **Roster System**: Advanced student enrollment and class offering synchronization.
- **Teacher/Parent Links**: Multi-role support for real-time student monitoring.

### 🎥 Real-Time Exam Proctoring
- **Live Monitor**: Teachers can track student status and violation counts in real-time.
- **Remote Interventions**: Instant "Warning" and "Force Submit" commands sent via WebSockets.
- **Integrity Tracking**: Automated detection of tab switching and fullscreen exit.

### 💬 Unified Communications
- **Real-Time Gateway**: Centralized WebSocket layer for Chat, Announcements, and System Alerts.
- **Notification Engine**: Role-based broadcast system with persistent history.

---

## 📚 API Documentation

Once the server is running, access the interactive Swagger documentation at:
🔗 **[http://localhost:4000/api-docs](http://localhost:4000/api-docs)**

---

## 🏗 Development Workflow

### Local Setup (No Docker)
1. Install dependencies: `npm install`
2. Start a local Postgres (mapped to port 5433) or use the Docker DB: `docker compose up -d db`
3. Run in dev mode: `npm run start:dev`

#### DATABASE_URL override for local stability
If your `.env` has a hosted `DATABASE_URL` (Neon/etc) but you want to run against local Postgres, set:

```bash
DB_USE_DATABASE_URL=false
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=trilink
DB_PASSWORD=trilink_secret
DB_DATABASE=trilink
```

This prevents runtime `ECONNRESET` from hosted DB interruptions during local development.

### Persistent Storage
The project uses Docker volumes to ensure that profile pictures and media assets persist across container restarts:
- Volume: `trilink_uploads` → `/app/uploads`

---

## Stabilization Notes

The current stabilized backend build passes with the existing NestJS routes. The web client should use the canonical exam attempt routes under `/api/attempts/:id/...` for answers, submission, grading, result loading, violations, and teacher controls.

Deferred backend work:
- Resource storage supports Cloudinary and S3-compatible object storage. Set `RESOURCE_STORAGE_DRIVER=s3` with the `RESOURCE_STORAGE_S3_*` variables for S3, R2, Spaces, or MinIO.
- AI routes require `AI_SERVICE_URL` for real AI behavior; without it, selected AI endpoints return explicit `not_configured` responses instead of sample AI content.
- Student sync endpoints return DB-backed status for notifications, released grades, attendance marks, and exam result release state.
- Production database migrations are available through `npm run migration:run`; production should keep TypeORM `synchronize` disabled.
- Chat read receipts use per-user conversation read tracking.

---

## 🤝 Folder Structure

```text
src/
├── common/           # Decorators, Guards, Utils
├── config/           # App & Secret configurations
├── modules/          # Feature-based architecture
│   ├── auth/         # Security & Roles
│   ├── realtime/     # WebSocket Gateway
│   ├── exams/        # Proctoring & Question Bank
│   └── ...           # Dashboards, Attendance, Users, etc.
└── main.ts           # Global entry point
```

---

## ⚖ License
Proprietary. Developed for the TriLink Educational Ecosystem.
