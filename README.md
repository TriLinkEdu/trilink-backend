# TriLink Backend

NestJS API for the TriLink school management platform. Provides authentication and admin-only registration for students, teachers, and parents.

## Stack

- **NestJS** – API framework
- **PostgreSQL** – TypeORM (default). Optional **SQLite** file DB via `DB_TYPE=sqlite` for local/mobile-style tooling only.
- **JWT** – Access + refresh tokens
- **Swagger** – API docs at `/api-docs`
- **class-validator** – DTO validation

## Setup

1. **Environment**
   - Create **`.env`** from **`.env.example`** (`.env` is gitignored). Defaults match **Docker Compose** Postgres (`trilink` / `trilink_secret` / database `trilink`).

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Database — pick one**

   **A. Docker (recommended)** — Postgres + API in containers:
   ```bash
   docker compose up --build
   ```
   - API: `http://localhost:4000/api` · Swagger: `/api-docs`
   - Postgres is mapped to host port **5433** (not 5432) so it does not conflict with a local PostgreSQL install.
   - First-time admin (uses the `seed` service on the same Docker network as `db`):
     ```bash
     docker compose --profile seed run --rm seed
     ```
   - **Postgres only** (Nest on the host): `docker compose up -d db`, then in `.env` use `DB_HOST=localhost` and **`DB_PORT=5433`**, then `npm run start:dev`.

   **B. Local Postgres** — create user/database matching `.env`, then `npm run start:dev`.

   **C. SQLite (optional)** — `DB_TYPE=sqlite` + `DB_SQLITE_PATH` for file-based / tooling only.

4. **Run (without Docker for the API)**
   ```bash
   npm run start:dev
   ```
   - API: `http://localhost:4000/api`
   - Swagger: `http://localhost:4000/api-docs`

5. **Seed admin** (first time only)
   - On host: `npm run seed`
   - After `docker compose up`: `docker compose --profile seed run --rm seed`
   - Uses `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `.env` (default: `admin@trilink.edu` / `Admin@123`).

## Roadmap (30 steps)

Full feature plan: **one commit per step**, test each step via **Swagger** (`/api-docs`), with Swagger documentation standards per step.

→ See **[docs/BACKEND_ROADMAP_30_STEPS.md](./docs/BACKEND_ROADMAP_30_STEPS.md)**

## Auth flow

- **Login:** `POST /api/auth/login` with `{ "email", "password", "role" }` → returns `accessToken`, `refreshToken`, `user`.
- **Refresh:** `POST /api/auth/refresh` with `{ "refreshToken" }` → new tokens.
- **Register (admin only):** `POST /api/auth/register` with `Authorization: Bearer <accessToken>` and body per Swagger. Admin is the only role that can register students, teachers, and parents. For parents, prefer **`linkedStudentId` + `relationship`** to link the correct student (names can duplicate); optional `childName` is display-only.

## API surface (high level)

All routes are under global prefix `/api` (default). Swagger groups:

| Tag | Routes (examples) |
|-----|-------------------|
| Auth | `POST /auth/login`, `/auth/refresh`, `/auth/register` |
| Users | `GET/PATCH /users`, `/users/:id` (admin) |
| Academic calendar | `/academic-years`, terms, `activate`, `close`, `rollover` |
| School structure | `/grades`, `/sections`, `/subjects` |
| Classes | `/class-offerings?academicYearId=` |
| Enrollments | `/enrollments` |
| Parents | `/parent-students` |
| Calendar | `/calendar-events` |
| Attendance | `/attendance-sessions`, marks, `/reports/attendance/...` |
| Exams | `/questions`, `/exams`, `/attempts/...` |
| Announcements | `/announcements`, `/announcements/for-me` |
| Feedback | `/feedback` |
| Notifications | `/notifications` |
| Chat | `/conversations`, `/chat/ws-info` + Socket.IO gateway |
| Dashboard | `/dashboard/admin|teacher|student|parent`, `/dashboard/children/:id/summary` |
| Settings | `/me/settings`, `/school/settings` |
| Files | `POST /files/upload`, `GET /files/:id` |
| Admin | `/audit-logs` |

## Folder structure

```
src/
├── config/
├── database/         # TypeORM root + entity registry
├── common/
├── modules/
│   ├── academic-years, announcements, attendance, audit, auth, calendar, chat,
│   ├── class-offerings, dashboards, enrollments, exams, feedback, files,
│   ├── notifications, parent-students, school-structure, settings, users
├── scripts/
└── main.ts
```

## Web / Mobile

- **Web:** Point Next.js API proxy or `fetch` to `http://localhost:4000/api` (e.g. `POST /api/auth/login`, `POST /api/auth/register` with Bearer token).
- **Mobile:** Set `ApiConstants.baseUrl` to `http://<host>:4000/api` and use `/auth/login`, `/auth/register`, `/auth/refresh`. On-device storage (e.g. SQLite in the app) is separate from this server, which targets **PostgreSQL**.
