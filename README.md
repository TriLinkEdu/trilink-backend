# TriLink Backend

NestJS API for the TriLink school management platform. Provides authentication and admin-only registration for students, teachers, and parents.

## Stack

- **NestJS** – API framework
- **SQLite (dev default) / PostgreSQL (production)** – TypeORM
- **JWT** – Access + refresh tokens
- **Swagger** – API docs at `/api-docs`
- **class-validator** – DTO validation

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Database**
   - **Development (default):** No PostgreSQL needed. With `NODE_ENV=development` (or unset), the app uses **SQLite** at `data/trilink.sqlite` unless you set `DB_TYPE=postgres`.
   - **PostgreSQL:** Set `DB_TYPE=postgres` in `.env` and configure `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` (create the user/database first).
   - Copy `.env.example` to `.env` and set `JWT_SECRET` (and DB vars if using Postgres).

3. **Run**
   ```bash
   npm run start:dev
   ```
   - API: `http://localhost:4000/api`
   - Swagger: `http://localhost:4000/api-docs`

4. **Seed admin** (first time only)
   ```bash
   npm run seed
   ```
   Uses `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `.env` (default: `admin@trilink.edu` / `Admin@123`).

## Auth flow

- **Login:** `POST /api/auth/login` with `{ "email", "password", "role" }` → returns `accessToken`, `refreshToken`, `user`.
- **Refresh:** `POST /api/auth/refresh` with `{ "refreshToken" }` → new tokens.
- **Register (admin only):** `POST /api/auth/register` with `Authorization: Bearer <accessToken>` and body per Swagger. Admin is the only role that can register students, teachers, and parents.

## Folder structure

```
src/
├── config/           # App configuration
├── database/         # TypeORM module
├── modules/
│   ├── auth/         # Login, refresh, JWT strategy, guards
│   └── users/        # User entity, admin registration
├── scripts/
│   └── seed-admin.ts # One-time admin seed
├── app.module.ts
└── main.ts
```

## Web / Mobile

- **Web:** Point Next.js API proxy or `fetch` to `http://localhost:4000/api` (e.g. `POST /api/auth/login`, `POST /api/auth/register` with Bearer token).
- **Mobile:** Set `ApiConstants.baseUrl` to `http://<host>:4000/api` and use `/auth/login`, `/auth/register`, `/auth/refresh`.
