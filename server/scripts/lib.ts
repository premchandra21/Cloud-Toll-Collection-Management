// Shared helpers for the evidence scripts.
// These talk to the API over HTTP only (no database access), so they run unchanged against
// localhost or the deployed system.
//
// Settings can be given as --name=value flags (works on every OS) or as environment variables:
//   --api=https://your-api.example.com/api/v1     API_URL
//   --operator=operator@toll.test                 OPERATOR_EMAIL      (assigned to BBS-01 by the seed)
//   --operator2=operator2@toll.test               OPERATOR2_EMAIL     (assigned to CTC-01 by the seed)
//   --admin=admin@toll.test                       ADMIN_EMAIL
//   --operator-password / --operator2-password / --admin-password   (or the *_PASSWORD env vars)

export function arg(name: string, envName: string, fallback: string): string {
  const flag = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (flag) return flag.slice(name.length + 3);
  return process.env[envName] ?? fallback;
}

export function intArg(name: string, envName: string, fallback: number): number {
  const n = Number(arg(name, envName, String(fallback)));
  if (!Number.isInteger(n) || n < 1) fail(`--${name} must be a positive whole number`);
  return n;
}

export const API = arg("api", "API_URL", "http://localhost:4000/api/v1").replace(/\/+$/, "");

export const accounts = {
  admin: {
    email: arg("admin", "ADMIN_EMAIL", "admin@toll.test"),
    password: arg("admin-password", "ADMIN_PASSWORD", "Admin@123"),
  },
  operator: {
    email: arg("operator", "OPERATOR_EMAIL", "operator@toll.test"),
    password: arg("operator-password", "OPERATOR_PASSWORD", "Operator@123"),
  },
  operator2: {
    email: arg("operator2", "OPERATOR2_EMAIL", "operator2@toll.test"),
    password: arg("operator2-password", "OPERATOR2_PASSWORD", "Operator@123"),
  },
};

export interface ApiResult {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any;
}

export async function call(method: string, path: string, token?: string, body?: unknown): Promise<ApiResult> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // empty or non-JSON body
  }
  return { status: res.status, json };
}

export function fail(message: string): never {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
}

// Free-tier hosts sleep when idle, so the first request can take a while. Wait for /health.
export async function warmUp(): Promise<void> {
  process.stdout.write(`Warming up ${API} `);
  for (let attempt = 1; attempt <= 18; attempt++) {
    try {
      const r = await call("GET", "/health");
      if (r.status === 200) {
        console.log("OK");
        return;
      }
    } catch {
      // not reachable yet
    }
    process.stdout.write(".");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  fail(`Could not reach ${API}/health. Is the server running and is --api correct?`);
}

export async function login(who: { email: string; password: string }): Promise<string> {
  const r = await call("POST", "/auth/login", undefined, who);
  if (r.status !== 200) {
    fail(`Login failed for ${who.email} (HTTP ${r.status}). Did you run "npm run seed"? ${r.json?.error?.message ?? ""}`);
  }
  return r.json.data.token as string;
}

export interface Driver {
  token: string;
  email: string;
}

export async function registerDriver(name: string, email: string): Promise<Driver> {
  const r = await call("POST", "/auth/register", undefined, { name, email, password: "Evidence@123" });
  if (r.status !== 201) fail(`Could not register ${email} (HTTP ${r.status}): ${r.json?.error?.message ?? ""}`);
  return { token: r.json.data.token as string, email };
}

export async function addVehicle(driver: Driver, vehicleNumber: string, vehicleType: string, rfidTag: string) {
  const r = await call("POST", "/vehicles", driver.token, { vehicleNumber, vehicleType, rfidTag });
  if (r.status !== 201) fail(`Could not add vehicle ${vehicleNumber} (HTTP ${r.status}): ${r.json?.error?.message ?? ""}`);
}

export async function topUp(driver: Driver, amount: string) {
  const r = await call("POST", "/wallet/top-up", driver.token, { amount });
  if (r.status !== 201) fail(`Top-up of ${amount} failed (HTTP ${r.status}): ${r.json?.error?.message ?? ""}`);
}

// ---- money without floats: work in whole cents ----

export function toCents(money: string): number {
  const [whole, frac = ""] = money.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0").slice(0, 2));
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

// ---- output helpers ----

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

export function runId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
}

export function printChecks(checks: { name: string; pass: boolean; detail: string }[]): boolean {
  console.log("");
  for (const c of checks) console.log(`  ${c.pass ? "PASS" : "FAIL"}  ${c.name}  (${c.detail})`);
  const ok = checks.every((c) => c.pass);
  console.log(`\n${ok ? "RESULT: PASS" : "RESULT: FAIL"}\n`);
  return ok;
}

export async function reconciliation(adminToken: string) {
  const r = await call("GET", "/reports/reconciliation", adminToken);
  if (r.status !== 200) fail(`Reconciliation request failed (HTTP ${r.status}): ${r.json?.error?.message ?? ""}`);
  return r.json.data as {
    ok: boolean;
    wallets: { checked: number; mismatched: number; mismatches: unknown[] };
    tolls: { successTolls: number; withoutMatchingDebit: number; debitsWithoutSuccessfulToll: number; duplicateDebits: number };
  };
}