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

## Deployment (cloud)
 
The system is deployed as a three-tier cloud architecture, entirely on free tiers:
 
| Tier | Platform | Cloud model | Role |
|---|---|---|---|
| Frontend (`client/`) | **Vercel** | Static hosting + global CDN | Serves the React app |
| Backend (`server/`) | **Render** (Web Service) | PaaS | Runs the stateless Express API |
| Database | **Neon** | Managed PostgreSQL (DBaaS) | Stores users, wallets, tolls and the audit ledger |
 
```text
Browser  -->  Vercel (React, CDN)  -->  Render (Express API)  -->  Neon (PostgreSQL)
                                          HTTPS + JWT              pooled connection (SSL)
```
 
**Live links** (replace with your own after deploying):
 
- Frontend: `https://cloud-toll-collection-management.vercel.app/`
- API health check: `https://cloud-toll-collection-management.onrender.com/api/v1/health`
The API is stateless (all state is in the database, authentication uses JWT), so it can be restarted
or scaled without losing data.
 
### Step 1: Database (Neon)
 
1. Sign up at <https://neon.tech> and click **Create project** (name it `toll-db`, choose the nearest region).
2. Open **Connect** on the dashboard and copy two connection strings:
   - **Connection pooling ON** (host contains `-pooler`) is the `DATABASE_URL`.
   - **Connection pooling OFF** is the `DIRECT_URL`, used only for migrations.
   Both must end with `?sslmode=require` and use the same password. Copy only the `postgresql://...` part.
3. From your computer, put both in `server/.env` and run the migrations and seed once:
```bash
   cd server
   npm install
   npm run build            # generate the Prisma client
   npm run migrate:deploy   # create tables and constraints (uses DIRECT_URL)
   npm run seed             # load demo users, plazas, rates, vehicles, wallets
```
4. Check that the tables and demo data appear under **Tables** in the Neon console.
### Step 2: Backend (Render)
 
1. Sign up at <https://render.com> and click **New > Web Service**, then connect the GitHub repository.
2. Use these settings:
   | Setting | Value |
   |---|---|
   | Root Directory | `server` |
   | Runtime | Node |
   | Build Command | `npm install && npm run build` |
   | Start Command | `npm start` |
   | Instance Type | Free |
   | Health Check Path | `/api/v1/health` |
3. Add these environment variables:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the pooled Neon connection string |
   | `JWT_SECRET` | a long random string (32+ characters) |
   | `NODE_VERSION` | `22` |
   | `CLIENT_ORIGIN` | the frontend URL, for example `https://cloud-toll-collection-management.vercel.app` (no trailing slash) |
   | `LOW_BALANCE_THRESHOLD`, `CREDIT_DUE_DAYS`, `CREDIT_TIMEZONE` | optional, defaults are used if omitted |
4. Deploy, then open `https://cloud-toll-collection-management.onrender.com/api/v1/health`. It should show `"db": "connected"`.
### Step 3: Frontend (Vercel)
 
1. Sign up at <https://vercel.com> and click **Add New > Project**, then import the repository.
2. Set **Root Directory** to `client`. The Vite preset is detected, and `client/vercel.json` already
   rewrites all routes to `index.html` so page refreshes work.
3. Add the environment variable `VITE_API_URL` = `https://cloud-toll-collection-management.onrender.com/api/v1`
   (include `/api/v1`, no trailing slash).
4. Deploy and copy the production URL.
5. If the site asks visitors to log in to Vercel, open **Settings > Deployment Protection** and turn
   **Vercel Authentication** off so the site is public.
### Step 4: Connect the pieces
 
Go back to Render and set `CLIENT_ORIGIN` to the final Vercel URL, then let the service redeploy.
A wrong `CLIENT_ORIGIN` is the most common cause of CORS errors. If you change `VITE_API_URL`, redeploy
the frontend, because Vite reads it at build time.
 
### Verify the deployment
 
1. Open the health URL and confirm `"db": "connected"`.
2. Open the frontend and log in with the demo accounts above.
3. Run the evidence scripts against the live API from `server/`:
```bash
   npm run evidence:concurrency -- --api=https://<your-api>.onrender.com/api/v1
   npm run evidence:reconcile   -- --api=https://<your-api>.onrender.com/api/v1
```
 
### Deployment notes
 
- **Cold starts:** Render's free tier sleeps after about 15 minutes of inactivity, and the first request can take
  30 to 60 seconds. Open the health URL a few minutes before a demo, or use a free uptime monitor such as UptimeRobot.
- **Free-tier limits** change over time, so check each provider's current plan before relying on them.
- **Migrations** are not run automatically on deploy. Run `npm run migrate:deploy` against Neon whenever the schema changes.
- **Environment variables** are set in each provider's dashboard. Never commit `.env` files.
### Deployment troubleshooting
 
| Problem | Fix |
|---|---|
| `Authentication failed ... credentials are not valid` (P1000) | The password in `DATABASE_URL` is wrong or outdated. Copy the Neon strings again, with no `psql '` prefix, no placeholders and no stray quotes |
| Browser shows a CORS error | `CLIENT_ORIGIN` on Render must exactly equal the frontend URL (no trailing slash). Save and let it redeploy |
| Frontend loads but API calls fail | Check `VITE_API_URL` on Vercel (it must end in `/api/v1`) and redeploy the frontend |
| First request is very slow | The free Render service is waking up. Wait about a minute, or open the health URL first |
| Vercel site asks for a login | Turn off Vercel Authentication under Deployment Protection |
| Refreshing an inner page gives 404 | Make sure `client/vercel.json` is committed |

## Security notes

- Never commit `.env` files or `server/src/generated`.
- Change the demo passwords and `JWT_SECRET` before any real deployment.
