// Concurrency + idempotency evidence (spec section 18.1).
//
// 1. Creates a fresh driver with a wallet that can pay for exactly AFFORD tolls.
// 2. Fires REQUESTS toll events AT THE SAME TIME, each with its own idempotency key.
//    Expected: exactly AFFORD succeed, the rest fail with insufficient balance, balance ends at 0.00.
// 3. Tops up one more toll and sends ONE event 10 times in parallel with the same key.
//    Expected: the driver is charged exactly once and every response points at the same transaction.
// 4. Runs the ledger reconciliation.
//
//   npm run evidence:concurrency
//   npm run evidence:concurrency -- --api=https://your-api.example.com/api/v1 --requests=50 --afford=10
//
// Each run leaves one "Concurrency Test Driver" account behind (harmless, but visible on the Users page).
import {
  accounts, addVehicle, API, call, fail, fromCents, intArg, login, printChecks, reconciliation,
  registerDriver, runId, toCents, topUp, warmUp, arg,
} from "./lib.js";

const REQUESTS = intArg("requests", "REQUESTS", 50);
const AFFORD = intArg("afford", "AFFORD", 10);
const PLAZA_CODE = arg("plaza", "PLAZA_CODE", "BBS-01");
const REPLAYS = 10;

if (AFFORD >= REQUESTS) fail("--afford must be smaller than --requests, otherwise nothing can fail.");

await warmUp();
const operator = await login(accounts.operator);
const admin = await login(accounts.admin);

// The operator only sees plazas assigned to them, so this also proves the scoping works.
const plazaRes = await call("GET", "/plazas", operator);
const plaza = plazaRes.json?.data?.plazas?.find((p: { code: string }) => p.code === PLAZA_CODE);
if (!plaza) fail(`${accounts.operator.email} has no plaza ${PLAZA_CODE}. Check the operator's plaza assignment.`);
const rate = plaza.rates.find((r: { vehicleType: string }) => r.vehicleType === "CAR");
if (!rate) fail(`${PLAZA_CODE} has no active CAR rate.`);
const tollCents = toCents(rate.amount);

const id = runId();
const driver = await registerDriver("Concurrency Test Driver", `concurrency-${id.toLowerCase()}@evidence.test`);
const rfidTag = `CT-${id}`;
await addVehicle(driver, `CT${id}`, "CAR", rfidTag);
await topUp(driver, fromCents(AFFORD * tollCents));

console.log(`\nPlaza ${PLAZA_CODE}, CAR toll ${fromCents(tollCents)}, wallet funded for exactly ${AFFORD} tolls (${fromCents(AFFORD * tollCents)})`);

const processToll = (key: string) =>
  call("POST", "/toll-transactions/process", operator, { rfidTag, plazaId: plaza.id, idempotencyKey: key });

async function walletBalance(): Promise<string> {
  const r = await call("GET", "/wallet", driver.token);
  return r.json.data.wallet.balance as string;
}

async function debitCount(): Promise<number> {
  const r = await call("GET", "/wallet/transactions?type=TOLL_DEBIT&pageSize=1", driver.token);
  return r.json.meta.total as number;
}

// ---------------- Test A: race ----------------
console.log(`\nTest A: ${REQUESTS} parallel toll requests, balance for ${AFFORD}`);
const startA = performance.now();
const results = await Promise.all(Array.from({ length: REQUESTS }, (_, i) => processToll(`conc-${id}-${i}`)));
const secondsA = (performance.now() - startA) / 1000;

const successes = results.filter((r) => r.status === 201 && r.json.data.status === "SUCCESS").length;
const insufficient = results.filter(
  (r) => r.status === 201 && r.json.data.status === "FAILED" && r.json.data.failureReason === "INSUFFICIENT_BALANCE",
).length;
const errors = results.length - successes - insufficient;

const balanceA = await walletBalance();
const debitsA = await debitCount();
console.log(`  successes: ${successes}   insufficient balance: ${insufficient}   other errors: ${errors}`);
console.log(`  final balance: ${balanceA}   TOLL_DEBIT ledger entries: ${debitsA}   (${secondsA.toFixed(2)}s)`);
if (errors > 0) {
  const sample = results.find((r) => !(r.status === 201));
  console.log("  sample error:", sample?.status, sample?.json?.error ?? sample?.json);
}

// ---------------- Test B: idempotent replay ----------------
console.log(`\nTest B: the SAME event sent ${REPLAYS} times in parallel (one idempotency key)`);
await topUp(driver, fromCents(tollCents));
const replayKey = `replay-${id}`;
const replays = await Promise.all(Array.from({ length: REPLAYS }, () => processToll(replayKey)));

const okReplays = replays.filter((r) => r.status === 200 || r.status === 201);
const transactionIds = new Set(okReplays.map((r) => r.json.data.transactionId as string));
const fresh = okReplays.filter((r) => r.json.data.idempotentReplay === false).length;
const balanceB = await walletBalance();
const debitsB = await debitCount();
console.log(`  accepted: ${okReplays.length}/${REPLAYS}   distinct transactions: ${transactionIds.size}   new charges: ${fresh}`);
console.log(`  final balance: ${balanceB}   TOLL_DEBIT ledger entries: ${debitsB}`);

// ---------------- Reconciliation ----------------
const rec = await reconciliation(admin);
console.log(`\nLedger reconciliation: ${rec.wallets.checked} wallets checked, ${rec.wallets.mismatched} mismatches`);

const ok = printChecks([
  { name: `exactly ${AFFORD} requests succeeded`, pass: successes === AFFORD, detail: `${successes} succeeded` },
  { name: `the other ${REQUESTS - AFFORD} failed with insufficient balance`, pass: insufficient === REQUESTS - AFFORD, detail: `${insufficient} failed` },
  { name: "no unexpected errors", pass: errors === 0, detail: `${errors} errors` },
  { name: "wallet never went negative and ends at 0.00", pass: balanceA === "0.00", detail: `balance ${balanceA}` },
  { name: "one ledger debit per successful toll", pass: debitsA === AFFORD, detail: `${debitsA} debits` },
  { name: "replayed event charged exactly once", pass: fresh === 1 && debitsB === AFFORD + 1 && balanceB === "0.00", detail: `${fresh} new charge, balance ${balanceB}` },
  { name: "every replay points at the same transaction", pass: okReplays.length === REPLAYS && transactionIds.size === 1, detail: `${transactionIds.size} distinct id(s)` },
  { name: "ledger reconciles (0 mismatches)", pass: rec.ok, detail: `${rec.wallets.mismatched} mismatched wallets` },
]);

console.log(`Run against ${API}`);
process.exit(ok ? 0 : 1);