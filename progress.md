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
- Registration creates a USER plus an empty wallet (balance 0.00) in one nested create.
- requireAuth verifies the JWT, then re-checks the user in the DB (exists + isActive); requireRole(...) runs after it.
- Client stores the JWT in localStorage; a 401 clears it and redirects to /login. Role homes: USER /app, OPERATOR /operator, ADMIN /admin (placeholder page until Slice 4+).
- Slice 2 (deploy) skipped; the teammate deploys after the app is built.
- Wallet ledger amounts are signed: credits positive, toll debits stored negative. Reconciliation is then a plain SUM(amount) per wallet, so Slice 6 must write TOLL_DEBIT rows as negative amounts.
- Vehicle number and RFID are normalised to uppercase (vehicle number also strips spaces and hyphens). Slice 6 must look vehicles up by RFID using rfidTagSchema from vehicle.schema.ts, so lookups match what is stored.
- A vehicle owned by someone else returns 404 (not 403), so its existence isn't leaked. ADMIN can access all vehicles but must pass userId when creating one.
- Top-up limits are ₹1 to ₹50,000 per request. The ledger shows referenceType SIMULATED_PAYMENT with a fake SIM- reference.
- Setting a rate deactivates the current active rate and inserts the new one in one transaction. Rates are never edited in place or deleted, because toll transactions reference rateId. Re-saving the same amount is a no-op (changed: false).
- GET /plazas (OPERATOR/ADMIN) returns each plaza with its active rates only. Slice 6 should look rates up with plazaId + vehicleType + isActive = true.
- Plaza codes are normalised to uppercase. Concurrent rate changes surface as a 409 CONFLICT via the partial unique index (P2002).
- POST /toll-transactions/process returns 201 with data.status SUCCESS or FAILED for a newly recorded event, and 200 with idempotentReplay: true for a repeated key.
- An idempotency key reused with a different RFID or plaza returns 409 DUPLICATE_TRANSACTION.
Rejected events (VEHICLE_NOT_FOUND, VEHICLE_INACTIVE, PLAZA_INACTIVE, TOLL_RATE_NOT_FOUND) are logged with console.warn and not stored.
- TOLL_DEBIT ledger rows are negative, with referenceType TOLL_TRANSACTION and referenceId set to the toll transaction id.
- Notifications (TOLL_SUCCESS, TOLL_FAILED, LOW_BALANCE) are already created after commit. Slice 7 only needs list and mark-read endpoints plus the UI.
- toll.repository.ts exports the shared txSelect shape, which Slice 7's list and detail endpoints should reuse.
- Tests use Node's built-in runner (npm test), and the 50-parallel and 20-duplicate concurrency cases already pass.

## Status
- [x] Slice 0: Scaffold client, server, Prisma 7, local Postgres, `/api/v1/health` returning db connected
- [x] Slice 0b: Frontend shell (Home, Login UI placeholder, NotFound, API status chip) — files provided, confirm it runs
- [x] Slice 1: Full Prisma schema (7 tables) + raw-SQL constraints + seed (1 admin, 1 operator, 2 users, 2 plazas, rates, vehicles, balances)
- [ ] Slice 2: Deploy skeleton to the cloud (managed Postgres, API host, client host, auto-deploy, `migrate deploy` + seed)
Skipping deployment for now will do it after developing the app.
- [x] Slice 3: Auth module (register, login, me, JWT, role middleware) + login/register pages + protected routes
- [x] Slice 4: Vehicles + wallet (CRUD, ownership checks, simulated top-up, ledger) + driver pages
- [x] Slice 5: Plazas + rates (admin CRUD, active-rate rule) + admin pages
- [x] Slice 6: Toll processing service + tests (idempotency, conditional debit, failures, low-balance) + operator toll simulator page
- [ ] Slice 7: Transactions list/detail/CSV export + notifications + admin users
- [ ] Slice 8: Dashboard aggregations (raw SQL) + dashboard pages
- [ ] Slice 9: Evidence scripts (`concurrency-test.ts`, `simulate-traffic.ts`, reconciliation query)
- [ ] Slice 10: Demo hardening (README, demo credentials, warm-up check, rehearsed demo path) + report/presentation

## Current slice
Slice 7

## Next action
Transactions list/detail/CSV export + notifications + admin users.

## Known gotchas
- Free-tier hosts sleep when idle; warm the API before any demo.
- Managed Postgres: use the pooled URL for the running app and the direct URL for migrations.
- Express route order: declare `/toll-transactions/export` before `/:id`.
- Never commit `.env` or `server/src/generated`.
- the replay response's remainingBalance is the wallet's current balance, not the balance at the time of the original toll.

## Demo credentials (fill in after seeding)
- Admin: admin@toll.test  /  Admin@123
- Operator: operator@toll.test  /  Operator@123
- Driver: asha@toll.test  /  Driver@123, ravi@toll.test  /  Driver@123

## Notes / issues log
-