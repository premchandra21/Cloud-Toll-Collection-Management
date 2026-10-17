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
- GET /toll-transactions is allowed for every role. A USER is scoped to their own vehicles in the repository query, and another user’s transaction id returns 404.
- Date filters take full ISO timestamps; from is inclusive and to is exclusive. The client builds them from local midnight, so “today” follows the user’s timezone.
- The CSV export caps at 10,000 rows, prefixes cells starting with = + - @ with an apostrophe (formula-injection guard), and the client downloads it via axios because a plain link can’t send the JWT.
- Notifications are USER-only. The list response includes unreadCount, which drives the bell badge (polled every 20 seconds). PATCH /notifications/read-all was added beyond the spec.
- PATCH /users/:id only toggles isActive, and an admin cannot deactivate themselves (409).
- Transactions are browsed under /app, /operator or /admin /transactions depending on role, using one shared page.
- Dashboard numbers are aggregated in PostgreSQL via $queryRaw tagged templates. Counts are cast to int and money to numeric(14,2)::text, so no BigInt, Decimal or float ever reaches the API.
- Time filters take ISO strings read as timestamptz and converted with AT TIME ZONE 'UTC', because processedAt is a naive UTC timestamp. This makes results independent of the DB session timezone. Days are bucketed in the caller’s tz (IANA name, validated; defaults to UTC), and the daily series is capped at the newest 90 days.
- Revenue counts SUCCESS tolls only. uncollected is the sum of FAILED toll amounts.
- The by-vehicle-type breakdown groups by the applied rate’s vehicleType, so editing a vehicle’s type later never rewrites history. Plazas and vehicle types with no traffic still appear with zeros.
- GET /dashboard/summary and GET /reports/revenue?groupBy=day|plaza|vehicleType are OPERATOR/ADMIN. One shared DashboardPage serves /admin and /operator/dashboard, and refetches every 15 seconds. The reconciliation endpoint is deferred to Slice 9.
- Pay-later frontend (slice 3 of the credit feature): the wallet summary now carries `credit` (limits, outstanding, usedThisMonth, available, overdue, nextDueAt, dueDays). The wallet page shows a credit panel, a dues list and a "Pay dues" button. The coverage preview mirrors the server (whole dues, most urgent first), but the server decides what is really paid. The button is disabled when the balance does not cover the oldest due.
- The simulator marks a credit pass as "Passed on credit, due by <date>" (blue, not green). Credit passes are SUCCESS toll rows with `onCredit`, so the UI treats "passed" and "collected" as different things. The dashboard says "passed" instead of "paid".
- Dashboard: Revenue earned = Collected + Owed. Overdue is part of Owed. Owed and overdue are evaluated as of now, for tolls inside the selected date range.
- FAILED reasons shown in the UI: INSUFFICIENT_BALANCE, CREDIT_OVERDUE, CREDIT_LIMIT_EXCEEDED, CREDIT_MONTHLY_LIMIT_EXCEEDED (labels in `utils/failureReasons.ts`). Unknown codes are shown as sent.
- Transaction list/detail DTOs now include `credit: { dueAt, settled, settledAt } | null` so every page can show Paid / Due / Overdue badges.
- Admin edits pay-later limits in a modal (native `<dialog>`), with an on/off switch. Off sends 0/0; on needs both limits above 0 (same rule as the API).
- Wallet summary and dues are polled every 20 s so a toll from another browser appears without a refresh.
- Money maths on the client is integer cents (`utils/money.ts`), never floats.

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
- [x] Slice 7: Transactions list/detail/CSV export + notifications + admin users
- [x] Slice 8: Dashboard aggregations (raw SQL) + dashboard pages
- [x] Slice 8b, operator-to-plaza scoping via the operator_plazas table.
- [x] Slice 9: Evidence scripts (`concurrency-test.ts`, `simulate-traffic.ts`, reconciliation query)
- [x] Slice 10: Demo hardening (README, demo credentials, warm-up check, rehearsed demo path) + report/presentation
- [x] Pay-later feature, slice 1 (DB, toll flow, notifications, reconciliation guard, tests)
- [x] Pay-later feature, slice 2 (pay-dues endpoint, wallet credit summary, admin limits, dashboard split, reminders)
- [x] Pay-later feature, slice 3 (frontend: wallet, simulator, notifications, admin users, dashboard, transaction badges)
- [ ] UI revamp (plan below)

## Current slice
Pay-later feature is complete (slices 1-3). Now: UI revamp (see the plan below). It must not change any behaviour.

## Next action
UI-0: create the `ui-revamp` branch, install Tailwind v4 and shadcn/ui.

## UI revamp plan
Why: the app works but looks plain (one hand-written CSS file, emoji icons, inline alerts).
Choice: Tailwind CSS v4 + shadcn/ui (Radix primitives) + lucide-react icons + sonner toasts + Recharts for charts.
- Fits the stack: React 19 + Vite + react-hook-form. shadcn's components are copied into `src/components/ui`, so we own the code (no heavy runtime library).
- Gives accessible dialogs, dropdowns, tables, tabs and selects without hand-building them.
- Rejected: MUI/Mantine (heavier, harder to restyle, locks the theme); more hand-written CSS (what we have now).
- Prerequisites: Node 20.19+ or 22.12+ (Vite requirement). Tailwind v4 has no tailwind.config file; config lives in `index.css` (`@import "tailwindcss"`, `@theme`) and the `@tailwindcss/vite` plugin.
- Rule: no behaviour changes. Each step is one commit and must pass `npm run build` and `npm run lint`, and the demo path (README) must still work.

Steps
- [ ] UI-0 Setup (branch `ui-revamp`): install `tailwindcss @tailwindcss/vite`, add the plugin and the `@/` alias (vite.config.ts and tsconfig.app.json), run `npx shadcn@latest init`, add base components (button, card, badge, input, label, select, table, dialog, alert, progress, skeleton, tabs, dropdown-menu, sonner). Note: Tailwind's preflight resets styles, so unmigrated pages look different until UI-2/UI-4. Keep the old `index.css` imported for now.
- [ ] UI-1 Design tokens: keep teal as primary; semantic badge colours (success = collected, warning = due soon / limit reached, danger = overdue / failed, sky = pay-later); Inter font; spacing and radius scale; decide light-only vs dark mode.
- [ ] UI-2 Shell: replace AppLayout with a sidebar (role-based links) and a top bar (notification bell, user menu with logout). Mobile: sheet menu. Restyle PublicLayout, Home, Login, Register.
- [ ] UI-3 Shared components: StatusBadge (one component for SUCCESS / FAILED / Pay later / Overdue), MoneyText, PageHeader, EmptyState, Spinner/Skeleton. Replace my `Modal` with shadcn Dialog and `Meter` with Progress. Replace inline success alerts with toasts.
- [ ] UI-4 Pages, by demo value: Wallet (hero balance card + credit panel + dues) -> Toll simulator (large result panel) -> Dashboards (KPI cards, Recharts bar/area charts, revenue split) -> Transactions / Transaction detail -> Admin Users and Plazas -> Vehicles, Notifications.
- [ ] UI-5 Polish: loading skeletons, empty states, check at 375 px width, keyboard focus and contrast, remove dead CSS from `index.css`, take screenshots for the report.
Risks: (1) the half-migrated look, so do it on a branch and migrate the shell first; (2) chart rewrite is the biggest single task, so it can be postponed or left as the current CSS bars; (3) do not change API shapes during the revamp.

## Known gotchas
- Free-tier hosts sleep when idle; warm the API before any demo.
- Managed Postgres: use the pooled URL for the running app and the direct URL for migrations.
- Express route order: declare `/toll-transactions/export` before `/:id`.
- Never commit `.env` or `server/src/generated`.
- the replay response's remainingBalance is the wallet's current balance, not the balance at the time of the original toll.

## Test run
- npm run evidence:concurrency
- npm run evidence:traffic
- npm run evidence:reconcile

## Demo credentials (fill in after seeding)
- Admin: admin@toll.test  /  Admin@123
- Operator: operator@toll.test  /  Operator@123
- Driver: asha@toll.test  /  Driver@123, ravi@toll.test  /  Driver@123

## Notes / issues log
-