// Traffic simulator (spec section 18.1): sends several hundred toll events across plazas and
// vehicle types so the dashboards show realistic data, and prints throughput and failure counts.
//
// Each operator only sends events for their own plazas (Operator One -> BBS-01, Operator Two -> CTC-01).
// One deliberately under-funded driver is included so some tolls fail with insufficient balance.
// At the end the script compares its own tally with the dashboard totals and runs the reconciliation.
//
//   npm run evidence:traffic
//   npm run evidence:traffic -- --api=https://your-api.example.com/api/v1 --events=300 --concurrency=10
//
// Each run leaves a few "Sim Driver" accounts behind (they are what makes the dashboard look busy).
import {
  accounts, addVehicle, API, call, fail, fromCents, intArg, login, percentile, reconciliation,
  registerDriver, runId, toCents, topUp, warmUp,
} from "./lib.js";
import type { Driver } from "./lib.js";

const EVENTS = intArg("events", "EVENTS", 300);
const CONCURRENCY = intArg("concurrency", "CONCURRENCY", 10);
const DRIVERS = intArg("drivers", "DRIVERS", 6);

const TYPES = ["CAR", "TRUCK", "BUS", "HEAVY_VEHICLE"] as const;
type VType = (typeof TYPES)[number];
// Roughly realistic mix of traffic
const WEIGHTS: Record<VType, number> = { CAR: 55, TRUCK: 20, BUS: 15, HEAVY_VEHICLE: 10 };

function pickType(allowed: VType[]): VType {
  const total = allowed.reduce((n, t) => n + WEIGHTS[t], 0);
  let roll = Math.random() * total;
  for (const t of allowed) {
    roll -= WEIGHTS[t];
    if (roll < 0) return t;
  }
  return allowed[0];
}

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

interface Plaza {
  id: string;
  code: string;
  isActive: boolean;
  rates: { vehicleType: VType; amount: string }[];
}

await warmUp();
const admin = await login(accounts.admin);
const operators = [
  { email: accounts.operator.email, token: await login(accounts.operator), plazas: [] as Plaza[] },
  { email: accounts.operator2.email, token: await login(accounts.operator2), plazas: [] as Plaza[] },
];

// Each operator only receives their own plazas from the API, which is exactly what we want to route by.
for (const op of operators) {
  const r = await call("GET", "/plazas", op.token);
  op.plazas = (r.json.data.plazas as Plaza[]).filter((p) => p.isActive && p.rates.length > 0);
}
const active = operators.filter((op) => op.plazas.length > 0);
if (active.length === 0) fail("No operator has an active plaza with rates. Run the seed and check plaza assignments.");

// ---- create the drivers and their vehicles ----
const id = runId();
console.log(`\nSetting up ${DRIVERS} drivers x ${TYPES.length} vehicles...`);
const vehicles: { rfidTag: string; type: VType }[] = [];
const drivers: Driver[] = [];
for (let d = 0; d < DRIVERS; d++) {
  const broke = d === DRIVERS - 1; // last driver is under-funded on purpose
  const driver = await registerDriver(`Sim Driver ${d + 1}`, `sim${d + 1}-${id.toLowerCase()}@evidence.test`);
  drivers.push(driver);
  for (const type of TYPES) {
    const rfidTag = `SIM-${id}-${d}-${type.slice(0, 2)}`;
    await addVehicle(driver, `SIM${id.slice(-6)}${d}${type.slice(0, 2)}`, type, rfidTag);
    // The broke driver's tag is used like any other, so its tolls fail once the small balance runs out.
    vehicles.push({ rfidTag, type });
  }
  await topUp(driver, broke ? "300.00" : "50000.00");
}

// ---- run the events ----
interface Outcome {
  operator: string;
  plaza: string;
  type: VType;
  httpStatus: number;
  tollStatus: "SUCCESS" | "FAILED" | null;
  cents: number;
  ms: number;
  error: string | null;
}

// Dashboard totals BEFORE the run. Comparing before/after avoids any clock difference between
// this computer and the API server.
const before = (await call("GET", "/dashboard/summary", admin)).json?.data?.totals;
const outcomes: Outcome[] = [];
let nextIndex = 0;

async function sendOne(index: number): Promise<Outcome> {
  const op = pick(active);
  const plaza = pick(op.plazas);
  const type = pickType(plaza.rates.map((r) => r.vehicleType));
  const vehicle = pick(vehicles.filter((v) => v.type === type));
  const rate = plaza.rates.find((r) => r.vehicleType === type)!;

  const t0 = performance.now();
  try {
    const r = await call("POST", "/toll-transactions/process", op.token, {
      rfidTag: vehicle.rfidTag,
      plazaId: plaza.id,
      idempotencyKey: `sim-${id}-${index}`,
    });
    const ms = performance.now() - t0;
    if (r.status === 201) {
      return {
        operator: op.email, plaza: plaza.code, type, httpStatus: 201, ms, error: null,
        tollStatus: r.json.data.status, cents: toCents(r.json.data.amount),
      };
    }
    return {
      operator: op.email, plaza: plaza.code, type, httpStatus: r.status, ms,
      tollStatus: null, cents: toCents(rate.amount), error: r.json?.error?.code ?? `HTTP_${r.status}`,
    };
  } catch (err) {
    return {
      operator: op.email, plaza: plaza.code, type, httpStatus: 0, ms: performance.now() - t0,
      tollStatus: null, cents: 0, error: err instanceof Error ? err.message : "NETWORK_ERROR",
    };
  }
}

async function worker() {
  while (nextIndex < EVENTS) {
    const index = nextIndex++;
    outcomes.push(await sendOne(index));
    if (outcomes.length % 50 === 0) console.log(`  ${outcomes.length}/${EVENTS} sent`);
  }
}

console.log(`\nSending ${EVENTS} toll events with ${CONCURRENCY} at a time to ${API}`);
const t0 = performance.now();
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
const seconds = (performance.now() - t0) / 1000;

// ---- report ----
const succeeded = outcomes.filter((o) => o.tollStatus === "SUCCESS");
const insufficient = outcomes.filter((o) => o.tollStatus === "FAILED");
const errored = outcomes.filter((o) => o.tollStatus === null);
const latencies = outcomes.map((o) => o.ms).sort((a, b) => a - b);
const revenueCents = succeeded.reduce((n, o) => n + o.cents, 0);

console.log("\n=== Traffic simulation result ===");
console.log(`  events sent:            ${outcomes.length}`);
console.log(`  duration:               ${seconds.toFixed(2)}s`);
console.log(`  throughput:             ${(outcomes.length / seconds).toFixed(1)} events/second`);
console.log(`  latency p50 / p95 / max ${percentile(latencies, 50).toFixed(0)} / ${percentile(latencies, 95).toFixed(0)} / ${latencies[latencies.length - 1].toFixed(0)} ms`);
console.log(`  collected (SUCCESS):    ${succeeded.length}   revenue ${fromCents(revenueCents)}`);
console.log(`  failed (insufficient):  ${insufficient.length}`);
console.log(`  errors (not recorded):  ${errored.length}`);
if (errored.length > 0) {
  const byCode: Record<string, number> = {};
  for (const e of errored) byCode[e.error ?? "UNKNOWN"] = (byCode[e.error ?? "UNKNOWN"] ?? 0) + 1;
  console.log("  error codes:", byCode);
}

const byPlaza: Record<string, number> = {};
const byType: Record<string, number> = {};
for (const o of outcomes) {
  byPlaza[o.plaza] = (byPlaza[o.plaza] ?? 0) + 1;
  byType[o.type] = (byType[o.type] ?? 0) + 1;
}
console.log("  events per plaza:", byPlaza);
console.log("  events per vehicle type:", byType);

// ---- compare with the dashboard ----
const after = (await call("GET", "/dashboard/summary", admin)).json?.data?.totals;
const recorded = succeeded.length + insufficient.length;
const dashTolls = before && after ? after.transactions - before.transactions : -1;
const dashRevenueCents = before && after ? toCents(after.revenue) - toCents(before.revenue) : -1;
const dashMatches = dashTolls === recorded && dashRevenueCents === revenueCents;
console.log("\n=== Dashboard comparison (admin, change in totals during the run) ===");
console.log(`  recorded by this script: ${recorded} tolls, revenue ${fromCents(revenueCents)}`);
console.log(`  dashboard grew by:       ${dashTolls} tolls, revenue ${fromCents(dashRevenueCents)}`);
console.log(
  dashMatches
    ? "  MATCH"
    : "  DIFFERENT (expected if someone else processed tolls during the run; rerun while the system is idle)",
);

const rec = await reconciliation(admin);
console.log(`\n=== Ledger reconciliation ===\n  ${rec.wallets.checked} wallets checked, ${rec.wallets.mismatched} mismatches -> ${rec.ok ? "OK" : "PROBLEM"}`);

const pass = errored.length === 0 && rec.ok && dashMatches;
console.log(`\n${pass ? "RESULT: PASS" : "RESULT: FAIL"}\n`);
process.exit(pass ? 0 : 1);