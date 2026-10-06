# PROGRESS.md — Cloud-Based Toll Collection System

Course project. Goal: a demo-ready MVP that shows how a cloud solution solves the toll-collection problem.
Source of truth for scope and rules: `Cloud_Toll_Collection_Project_Spec_v2.docx`.
Last updated: 2026-10-06

## How to use this file
- Paste this file (plus only the files a slice touches) at the start of every new AI chat.
- Work on ONE slice per chat. Ask for complete files, minimal explanation.
- At the end of each chat, update "Status", "Decisions" and "Next action", then commit.

## Stack and conventions (paste into every chat)
- Monorepo: `client/` (React + Vite + TypeScript) and `server/` (Express + TypeScript).
- Client: React Router, TanStack Query, Axios, react-hook-form, plain CSS (`src/index.css`).
- Server: Express, Zod validation, JWT auth, bcryptjs, helmet, cors.
- Database: PostgreSQL. Local DB name `toll_db`. ORM: Prisma 7 (`prisma@prev`, `@prisma/client@7`) with `@prisma/adapter-pg`.
  - Prisma client is generated to `server/src/generated/prisma` (git-ignored). Import it from `src/config/database.ts` only.
  - Config file is `prisma7.config.ts` (or `prisma.config.ts`); `.env` is loaded with `import "dotenv/config"`.
  - Run `npx prisma generate` after schema changes; migrations with `npx prisma migrate dev --name <name>`.
- Server TypeScript uses `module: NodeNext`, so relative imports MUST end in `.js`.
- Raw SQL only via `prisma.$queryRaw` tagged templates (never `$queryRawUnsafe`).
- API base: `/api/v1`. Response shape: `{ success, message, data }`. Money values are strings ("80.00"), never floats.
- Env vars (server): `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CLIENT_ORIGIN`, `LOW_BALANCE_THRESHOLD`. Client: `VITE_API_URL`.

## Decisions log
- Prisma 7 chosen over Prisma 8 (release candidate) for stability.
- Hybrid data access: Prisma for CRUD/migrations/seed; raw SQL only for the partial unique index, the CHECK (balance >= 0), and dashboard aggregations.
- Atomic debit = conditional `updateMany` (balance >= amount) inside `prisma.$transaction`; idempotency via UNIQUE `idempotencyKey` (catch P2002 outside the transaction, return the existing record).
- Only INSUFFICIENT_BALANCE creates a FAILED toll transaction; other rejections return an error and are not stored (MVP).
- Registration always creates role USER; operator/admin accounts come from the seed.
- Full schema is created once (one planned migration), then work proceeds in vertical slices (backend + frontend per module).
- Cloud skeleton is deployed right after the schema, before feature modules.

## Status
- [x] Slice 0: Scaffold client, server, Prisma 7, local Postgres, `/api/v1/health` returning db connected
- [ ] Slice 0b: Frontend shell (Home, Login UI placeholder, NotFound, API status chip) — files provided, confirm it runs
- [ ] Slice 1: Full Prisma schema (7 tables) + raw-SQL constraints + seed (1 admin, 1 operator, 2 users, 2 plazas, rates, vehicles, balances)
- [ ] Slice 2: Deploy skeleton to the cloud (managed Postgres, API host, client host, auto-deploy, `migrate deploy` + seed)
- [ ] Slice 3: Auth module (register, login, me, JWT, role middleware) + login/register pages + protected routes
- [ ] Slice 4: Vehicles + wallet (CRUD, ownership checks, simulated top-up, ledger) + driver pages
- [ ] Slice 5: Plazas + rates (admin CRUD, active-rate rule) + admin pages
- [ ] Slice 6: Toll processing service + tests (idempotency, conditional debit, failures, low-balance) + operator toll simulator page
- [ ] Slice 7: Transactions list/detail/CSV export + notifications + admin users
- [ ] Slice 8: Dashboard aggregations (raw SQL) + dashboard pages
- [ ] Slice 9: Evidence scripts (`concurrency-test.ts`, `simulate-traffic.ts`, reconciliation query)
- [ ] Slice 10: Demo hardening (README, demo credentials, warm-up check, rehearsed demo path) + report/presentation

## Current slice
Slice 0b -> Slice 1

## Next action
1. Copy the frontend page files into `client/`, delete `client/src/App.css`, run `npm run dev`, confirm the home page loads and the footer chip shows the API state.
2. Commit.
3. Start Slice 1 in a new chat: paste this file + `server/prisma/schema.prisma` + spec Sections 5 and 5.2.

## Known gotchas
- Free-tier hosts sleep when idle; warm the API before any demo.
- Managed Postgres: use the pooled URL for the running app and the direct URL for migrations.
- Express route order: declare `/toll-transactions/export` before `/:id`.
- Never commit `.env` or `server/src/generated`.

## Demo credentials (fill in after seeding)
- Admin: 
- Operator: 
- Driver: 

## Notes / issues log
-