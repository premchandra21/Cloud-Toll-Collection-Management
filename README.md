# Cloud-Based Toll Collection & Revenue Management System

A web system that simulates RFID-based toll collection on a central cloud-ready platform.
Drivers keep a prepaid wallet, operators process toll events at plazas, and admins manage
plazas, rates and users. Every toll is charged exactly once, a wallet can never go below zero,
and every rupee is written to an audit ledger.

RFID hardware and real payments are simulated (an operator types the tag number, and top-ups are fake).

## Tech stack

| Part | Technology |
|---|---|
| Frontend (`client/`) | React, TypeScript, Vite, React Router, TanStack Query, Axios |
| Backend (`server/`) | Node.js, Express 5, TypeScript, Zod, JWT, bcryptjs, helmet, cors |
| Database | PostgreSQL with Prisma 7 (plus a few raw SQL queries and constraints) |

## Prerequisites

- Node.js 22 or newer
- PostgreSQL installed and running locally (default port 5432)
- Git

## Run it locally

### 1. Get the code

```bash
git clone https://github.com/premchandra21/Cloud-Toll-Collection-Management.git
cd <repo-folder>
```

### 2. Create the database

Create an empty database called `toll_db`. Either use pgAdmin, or:

```bash
psql -U postgres -c "CREATE DATABASE toll_db;"
```

### 3. Set up and start the server

```bash
cd server
npm install
```

Create your env file from the example:

```bash
# macOS / Linux / Git Bash
cp .env.example .env

# Windows (Command Prompt)
copy .env.example .env
```

Open `server/.env` and set at least:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/toll_db"
JWT_SECRET="any-long-random-string-at-least-8-chars"
```

The other values (`PORT=4000`, `CLIENT_ORIGIN=http://localhost:5173`, `LOW_BALANCE_THRESHOLD=100`,
`JWT_EXPIRES_IN=1d`) can stay as they are. Then run these once:

```bash
npm run build           # generates the Prisma client (server/src/generated, git-ignored)
npm run migrate:deploy  # creates all tables and the extra database constraints
npm run seed            # loads demo users, plazas, rates, vehicles and wallets
```

Start the API:

```bash
npm run dev
```

Check it is alive: open <http://localhost:4000/api/v1/health>. You should see `"db": "connected"`.

### 4. Set up and start the client

In a second terminal:

```bash
cd client
npm install
```

```bash
# macOS / Linux / Git Bash
cp .env.example .env

# Windows (Command Prompt)
copy .env.example .env
```

`client/.env` should contain:

```env
VITE_API_URL=http://localhost:4000/api/v1
```

Start the website:

```bash
npm run dev
```

Open <http://localhost:5173>.

## Demo accounts (created by the seed)

| Role | Email | Password | Notes |
|---|---|---|---|
| Admin | admin@toll.test | Admin@123 | Full access |
| Operator | operator@toll.test | Operator@123 | Assigned to plaza **BBS-01** only |
| Operator | operator2@toll.test | Operator@123 | Assigned to plaza **CTC-01** only |
| Driver | asha@toll.test | Driver@123 | Balance 500.00, cars/trucks |
| Driver | ravi@toll.test | Driver@123 | Balance 50.00, one bus |

Demo vehicles: `RFID-0001` (Asha's car), `RFID-0002` (Asha's truck), `RFID-0003` (Ravi's bus).
Demo rates (BBS-01 / CTC-01): car 80 / 60, bus 160 / 120, truck 200 / 150, heavy vehicle 320 / 250.

## Suggested demo walk-through

1. Log in as **Asha** and show the wallet, vehicles and balance (500.00).
2. Add a vehicle and top up the wallet.
3. Log in as **operator@toll.test**. In the Toll Simulator choose plaza BBS-01, enter `RFID-0001`, and process. The result is SUCCESS and the car pays 80.00.
4. Back as Asha, check the new balance (420.00), the transaction and the notification.
5. As the operator, process `RFID-0003` (Ravi's bus, 160 against a balance of 50). The result is FAILED (insufficient balance) and nothing is deducted.
6. Try the same toll again with the same idempotency key. It is not charged twice.
7. Show that this operator cannot process tolls at CTC-01 (plaza scoping).
8. Log in as **admin** and show the dashboard, plazas and rates, users, and the CSV export.
9. Run the evidence scripts (below) and show the PASS results.

## Tests and checks

All commands run from `server/`.

```bash
npm run typecheck   # TypeScript check for src/ and scripts/
npm test            # toll processing, plaza scoping and reconciliation tests
```

The tests use your local database and the seeded demo accounts. They create their own temporary
data and remove it afterwards, so your demo data is not touched.

### Evidence scripts

Start the API first (`npm run dev`), then in another terminal:

```bash
npm run evidence:concurrency   # many parallel tolls on one wallet: balance never goes negative
npm run evidence:traffic       # sends hundreds of tolls across plazas to fill the dashboards
npm run evidence:reconcile     # ledger sum equals wallet balance for every wallet
```

Each script ends with `RESULT: PASS` or `RESULT: FAIL`. To point them at another API (for example a
deployed one), add `--api=https://your-api.example.com/api/v1` or set `API_URL`.

## Useful commands

| Command (in `server/`) | What it does |
|---|---|
| `npm run dev` | Start the API with auto-reload |
| `npm run build` | Generate the Prisma client |
| `npm run migrate:deploy` | Apply database migrations |
| `npm run seed` | Load demo data (safe to run again) |
| `npx prisma migrate reset --config prisma7.config.ts` | Wipe the database, re-migrate and re-seed |

| Command (in `client/`) | What it does |
|---|---|
| `npm run dev` | Start the website on port 5173 |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |

## Project structure

```text
client/                 React website
  src/pages/            Screens (user, operator, admin, dashboard, transactions)
  src/features/         API calls and hooks per feature
server/
  prisma/               schema.prisma, migrations, seed.ts
  src/modules/          auth, vehicles, wallet, plazas, toll, notifications,
                        users, dashboard, reports (routes -> controller -> service -> repository)
  scripts/              evidence scripts (concurrency, traffic, reconciliation)
progress.md             Build log and decisions
```

## How the toll rules work

- **No double charge:** every toll event carries a unique idempotency key. Sending it again returns the original result.
- **No negative balance:** the wallet is debited with one conditional database update, and a CHECK constraint backs it up.
- **All or nothing:** the debit, the toll record and the ledger entry are saved in one database transaction.
- **Audit ledger:** wallet history is append-only, and a reconciliation check compares it with the balances.
- **Plaza scoping:** an operator can only process and view tolls for the plazas assigned to them.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Invalid environment variables` on server start | Check that `server/.env` exists and has `DATABASE_URL` and `JWT_SECRET` (at least 8 characters) |
| `Cannot find module '../generated/prisma/client.js'` | Run `npm run build` in `server/` |
| `password authentication failed` | The password in `DATABASE_URL` does not match your PostgreSQL password |
| `database "toll_db" does not exist` | Create it (step 2), then run `npm run migrate:deploy` |
| Login fails in the scripts or the UI | Run `npm run seed` |
| Browser shows a CORS or network error | The API must be running, `CLIENT_ORIGIN` must equal the frontend address, and `VITE_API_URL` must be correct. Restart both after editing `.env` files |
| Port 4000 or 5173 already in use | Stop the other process, or change `PORT` and update `VITE_API_URL` |

## Deployment (not done yet)

The app is designed to be deployed as a static frontend, a stateless API and a managed PostgreSQL
database. For managed databases, use the pooled connection string as `DATABASE_URL` and the direct one as
`DIRECT_URL` (used only for migrations). Run `npm run migrate:deploy` and `npm run seed` once against the
cloud database. Free hosting plans may put the API to sleep when idle, so open `/api/v1/health` before a demo.

## Security notes

- Never commit `.env` files or `server/src/generated`.
- Change the demo passwords and `JWT_SECRET` before any real deployment.