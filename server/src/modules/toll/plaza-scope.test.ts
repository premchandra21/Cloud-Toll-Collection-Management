// Integration tests: an OPERATOR can only work with the plazas assigned to them.
// Run:  npm test   (from server/)
//
// Everything these tests need (two plazas, four staff accounts, one driver) is created here with
// unique names and removed again in after(), so your demo data is not touched. Tokens are signed
// directly, so no seeded passwords are needed.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { app } from "../../app.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";

const RUN = randomUUID().slice(0, 8).toUpperCase();

let server: Server;
let baseUrl = "";

const plazaIds: string[] = [];
const userIds: string[] = [];
let plazaA = { id: "", code: "" };
let plazaB = { id: "", code: "" };
let driver = { userId: "", walletId: "", rfidTag: "" };
let txA = ""; // a SUCCESS toll at plaza A, processed by operator A
let txB = ""; // a SUCCESS toll at plaza B, processed by operator B
let keyB = ""; // the idempotency key behind txB

const staff = {
  opA: { id: "", token: "" }, // assigned to plaza A only
  opB: { id: "", token: "" }, // assigned to plaza B only
  opNone: { id: "", token: "" }, // operator with no plaza at all
  admin: { id: "", token: "" },
};

// ---------- helpers ----------

async function call(method: string, path: string, token: string, body?: unknown) {
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON (the CSV export)
  }
  return { status: res.status, json, text };
}

const processToll = (token: string, plazaId: string, idempotencyKey: string = randomUUID()) =>
  call("POST", "/toll-transactions/process", token, {
    rfidTag: driver.rfidTag,
    plazaId,
    idempotencyKey,
  });

async function makeStaff(role: "OPERATOR" | "ADMIN", name: string, assignTo: string[] = []) {
  const user = await prisma.user.create({
    data: { name: `${name} ${RUN}`, email: `${name.toLowerCase()}-${RUN.toLowerCase()}@test.local`, passwordHash: "not-used", role },
  });
  userIds.push(user.id);
  if (assignTo.length > 0) {
    await prisma.operatorPlaza.createMany({ data: assignTo.map((plazaId) => ({ userId: user.id, plazaId })) });
  }
  const token = jwt.sign({ role }, env.JWT_SECRET, { subject: user.id, expiresIn: "1h" });
  return { id: user.id, token };
}

async function driverBalance() {
  const w = await prisma.wallet.findUniqueOrThrow({ where: { id: driver.walletId } });
  return w.balance.toFixed(2);
}

// ---------- setup / teardown ----------

before(async () => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  for (const [label, target] of [["A", (v: typeof plazaA) => (plazaA = v)], ["B", (v: typeof plazaB) => (plazaB = v)]] as const) {
    const p = await prisma.tollPlaza.create({
      data: { name: `Scope Plaza ${label} ${RUN}`, code: `S${label}${RUN}`, location: "Test road" },
    });
    await prisma.tollRate.create({ data: { plazaId: p.id, vehicleType: "CAR", amount: "80.00" } });
    plazaIds.push(p.id);
    target({ id: p.id, code: p.code });
  }

  staff.opA = await makeStaff("OPERATOR", "OpA", [plazaA.id]);
  staff.opB = await makeStaff("OPERATOR", "OpB", [plazaB.id]);
  staff.opNone = await makeStaff("OPERATOR", "OpNone");
  staff.admin = await makeStaff("ADMIN", "Admin");

  // One driver with plenty of balance (every test toll costs 80.00)
  const tag = `SCOPE-${RUN}`;
  const user = await prisma.user.create({
    data: { name: `Scope Driver ${RUN}`, email: `driver-${RUN.toLowerCase()}@test.local`, passwordHash: "not-used" },
  });
  userIds.push(user.id);
  const wallet = await prisma.wallet.create({ data: { userId: user.id, balance: "2000.00" } });
  await prisma.walletTransaction.create({
    data: { walletId: wallet.id, type: "TOP_UP", amount: "2000.00", balanceAfter: "2000.00", referenceType: "TEST" },
  });
  await prisma.vehicle.create({
    data: { userId: user.id, vehicleNumber: `SC${RUN}`, vehicleType: "CAR", rfidTag: tag },
  });
  driver = { userId: user.id, walletId: wallet.id, rfidTag: tag };

  // One real toll at each plaza, processed by the operator who owns it
  const a = await processToll(staff.opA.token, plazaA.id);
  assert.equal(a.status, 201, "operator A must be able to work at plaza A");
  txA = a.json.data.transactionId;

  keyB = randomUUID();
  const b = await processToll(staff.opB.token, plazaB.id, keyB);
  assert.equal(b.status, 201, "operator B must be able to work at plaza B");
  txB = b.json.data.transactionId;
});

after(async () => {
  const vehicles = await prisma.vehicle.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const vehicleIds = vehicles.map((v) => v.id);

  await prisma.tollTransaction.deleteMany({
    where: { OR: [{ vehicleId: { in: vehicleIds } }, { plazaId: { in: plazaIds } }] },
  });
  await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: { in: userIds } } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.vehicle.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.operatorPlaza.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { plazaId: { in: plazaIds } }] } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.tollRate.deleteMany({ where: { plazaId: { in: plazaIds } } });
  await prisma.tollPlaza.deleteMany({ where: { id: { in: plazaIds } } });

  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

// ---------- tests ----------

describe("processing tolls", () => {
  it("an operator cannot collect a toll at a plaza they are not assigned to: 403, nothing charged or stored", async () => {
    const before = await driverBalance();
    const key = randomUUID();

    const { status, json } = await processToll(staff.opA.token, plazaB.id, key);

    assert.equal(status, 403);
    assert.equal(json.error.code, "PLAZA_NOT_ASSIGNED");
    assert.equal(await driverBalance(), before);
    assert.equal(await prisma.tollTransaction.count({ where: { idempotencyKey: key } }), 0);
  });

  it("an operator cannot replay another plaza's idempotency key to read that toll", async () => {
    // Same key, other plaza: blocked before the key is even looked up
    const viaOtherPlaza = await processToll(staff.opA.token, plazaB.id, keyB);
    assert.equal(viaOtherPlaza.status, 403);
    assert.equal(viaOtherPlaza.json.data, undefined, "no transaction data may leak");

    // Same key claimed for the operator's own plaza: rejected as a different event, no data either
    const viaOwnPlaza = await processToll(staff.opA.token, plazaA.id, keyB);
    assert.equal(viaOwnPlaza.status, 409);
    assert.equal(viaOwnPlaza.json.error.code, "DUPLICATE_TRANSACTION");
    assert.equal(viaOwnPlaza.json.data, undefined);
  });

  it("an operator with no plazas assigned cannot process anything: 403", async () => {
    for (const plaza of [plazaA, plazaB]) {
      const { status, json } = await processToll(staff.opNone.token, plaza.id);
      assert.equal(status, 403);
      assert.equal(json.error.code, "PLAZA_NOT_ASSIGNED");
    }
  });

  it("an unknown plaza is still 404 for an operator", async () => {
    const { status, json } = await processToll(staff.opA.token, randomUUID());
    assert.equal(status, 404);
    assert.equal(json.error.code, "RESOURCE_NOT_FOUND");
  });
});

describe("plaza list", () => {
  const ids = (json: { data: { plazas: { id: string }[] } }) => json.data.plazas.map((p) => p.id);

  it("operator A sees only plaza A", async () => {
    const { status, json } = await call("GET", "/plazas", staff.opA.token);
    assert.equal(status, 200);
    assert.deepEqual(ids(json), [plazaA.id]);
  });

  it("an operator with no plazas gets an empty list", async () => {
    const { json } = await call("GET", "/plazas", staff.opNone.token);
    assert.deepEqual(ids(json), []);
  });

  it("an admin sees every plaza", async () => {
    const { json } = await call("GET", "/plazas", staff.admin.token);
    const all = ids(json);
    assert.ok(all.includes(plazaA.id) && all.includes(plazaB.id));
  });
});

describe("transactions", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plazaCodes = (json: any) => json.data.transactions.map((t: any) => t.plaza.code);

  it("operator A's list only contains plaza A", async () => {
    const { status, json } = await call("GET", "/toll-transactions", staff.opA.token);
    assert.equal(status, 200);
    assert.deepEqual(plazaCodes(json), [plazaA.code]);
    assert.equal(json.meta.total, 1);
  });

  it("asking for another plaza with the plazaId filter returns nothing, not an error and not data", async () => {
    const { status, json } = await call("GET", `/toll-transactions?plazaId=${plazaB.id}`, staff.opA.token);
    assert.equal(status, 200);
    assert.deepEqual(json.data.transactions, []);
    assert.equal(json.meta.total, 0);
  });

  it("an operator with no plazas sees no transactions", async () => {
    const { json } = await call("GET", "/toll-transactions", staff.opNone.token);
    assert.deepEqual(json.data.transactions, []);
  });

  it("another plaza's transaction by id is 404; their own is 200; an admin can open both", async () => {
    assert.equal((await call("GET", `/toll-transactions/${txB}`, staff.opA.token)).status, 404);
    assert.equal((await call("GET", `/toll-transactions/${txA}`, staff.opA.token)).status, 200);
    assert.equal((await call("GET", `/toll-transactions/${txB}`, staff.admin.token)).status, 200);
    assert.equal((await call("GET", `/toll-transactions/${txA}`, staff.admin.token)).status, 200);
  });

  it("the CSV export contains only the operator's own plaza", async () => {
    const { status, text } = await call("GET", "/toll-transactions/export", staff.opA.token);
    assert.equal(status, 200);
    assert.ok(text.includes(plazaA.code));
    assert.ok(!text.includes(plazaB.code), "plaza B must not appear in operator A's export");
  });

  it("an admin can still filter to any single plaza", async () => {
    const { json } = await call("GET", `/toll-transactions?plazaId=${plazaB.id}`, staff.admin.token);
    assert.deepEqual(plazaCodes(json), [plazaB.code]);
  });
});

describe("dashboard and revenue report", () => {
  it("operator A's dashboard counts only plaza A", async () => {
    const { status, json } = await call("GET", "/dashboard/summary", staff.opA.token);
    assert.equal(status, 200);
    const d = json.data;

    assert.equal(d.scope.allPlazas, false);
    assert.equal(d.totals.transactions, 1);
    assert.equal(d.totals.revenue, "80.00");
    assert.deepEqual(d.byPlaza.map((p: { code: string }) => p.code), [plazaA.code]);
    assert.equal(d.byVehicleType.find((v: { vehicleType: string }) => v.vehicleType === "CAR").transactions, 1);
    assert.equal(d.byDay.reduce((n: number, row: { transactions: number }) => n + row.transactions, 0), 1);
  });

  it("an operator with no plazas gets all-zero numbers", async () => {
    const { json } = await call("GET", "/dashboard/summary", staff.opNone.token);
    assert.equal(json.data.totals.transactions, 0);
    assert.equal(json.data.totals.revenue, "0.00");
    assert.deepEqual(json.data.byPlaza, []);
    assert.deepEqual(json.data.byDay, []);
  });

  it("an admin's dashboard covers every plaza", async () => {
    const { json } = await call("GET", "/dashboard/summary", staff.admin.token);
    const d = json.data;
    assert.equal(d.scope.allPlazas, true);
    const codes = d.byPlaza.map((p: { code: string }) => p.code);
    assert.ok(codes.includes(plazaA.code) && codes.includes(plazaB.code));
  });

  it("the revenue report is scoped the same way, for every grouping", async () => {
    for (const groupBy of ["plaza", "vehicleType", "day"]) {
      const { status, json } = await call("GET", `/reports/revenue?groupBy=${groupBy}`, staff.opA.token);
      assert.equal(status, 200);
      assert.equal(json.data.totals.transactions, 1, `totals for groupBy=${groupBy}`);
    }
    const byPlaza = await call("GET", "/reports/revenue?groupBy=plaza", staff.opA.token);
    assert.deepEqual(byPlaza.json.data.rows.map((r: { key: string }) => r.key), [plazaA.code]);
  });
});

describe("admin assigns plazas to operators", () => {
  it("an operator gets access on the very next request, and loses it again just as fast", async () => {
    const before = await call("GET", "/plazas", staff.opNone.token);
    assert.deepEqual(before.json.data.plazas, []);

    const granted = await call("PUT", `/users/${staff.opNone.id}/plazas`, staff.admin.token, {
      plazaIds: [plazaA.id, plazaA.id], // duplicates are harmless
    });
    assert.equal(granted.status, 200);
    assert.deepEqual(granted.json.data.user.plazas.map((p: { id: string }) => p.id), [plazaA.id]);

    assert.equal((await processToll(staff.opNone.token, plazaA.id)).status, 201);
    assert.equal((await processToll(staff.opNone.token, plazaB.id)).status, 403);

    const revoked = await call("PUT", `/users/${staff.opNone.id}/plazas`, staff.admin.token, { plazaIds: [] });
    assert.equal(revoked.status, 200);
    assert.deepEqual(revoked.json.data.user.plazas, []);
    assert.equal((await processToll(staff.opNone.token, plazaA.id)).status, 403);
  });

  it("a group of plazas works: the operator can use every plaza in the set and no other", async () => {
    await call("PUT", `/users/${staff.opNone.id}/plazas`, staff.admin.token, { plazaIds: [plazaA.id, plazaB.id] });
    assert.equal((await processToll(staff.opNone.token, plazaA.id)).status, 201);
    assert.equal((await processToll(staff.opNone.token, plazaB.id)).status, 201);

    const { json } = await call("GET", "/plazas", staff.opNone.token);
    assert.deepEqual(json.data.plazas.map((p: { id: string }) => p.id).sort(), [plazaA.id, plazaB.id].sort());
  });

  it("the user list shows each operator's plazas", async () => {
    const { json } = await call("GET", `/users?role=OPERATOR&q=OpA-${RUN.toLowerCase()}`, staff.admin.token);
    const row = json.data.users.find((u: { id: string }) => u.id === staff.opA.id);
    assert.deepEqual(row.plazas.map((p: { code: string }) => p.code), [plazaA.code]);
  });

  it("only an admin may change assignments: an operator gets 403", async () => {
    const { status } = await call("PUT", `/users/${staff.opB.id}/plazas`, staff.opA.token, { plazaIds: [plazaA.id] });
    assert.equal(status, 403);
    // and nothing changed
    const { json } = await call("GET", "/plazas", staff.opB.token);
    assert.deepEqual(json.data.plazas.map((p: { id: string }) => p.id), [plazaB.id]);
  });

  it("plazas can only be assigned to operators (409 for a driver or an admin)", async () => {
    for (const id of [driver.userId, staff.admin.id]) {
      const { status, json } = await call("PUT", `/users/${id}/plazas`, staff.admin.token, { plazaIds: [plazaA.id] });
      assert.equal(status, 409);
      assert.equal(json.error.code, "CONFLICT");
    }
  });

  it("an unknown plaza is 404 and a malformed id is 400, and neither changes the existing assignment", async () => {
    const unknown = await call("PUT", `/users/${staff.opA.id}/plazas`, staff.admin.token, {
      plazaIds: [plazaA.id, randomUUID()],
    });
    assert.equal(unknown.status, 404);

    const malformed = await call("PUT", `/users/${staff.opA.id}/plazas`, staff.admin.token, { plazaIds: ["nope"] });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.json.error.code, "VALIDATION_ERROR");

    const { json } = await call("GET", "/plazas", staff.opA.token);
    assert.deepEqual(json.data.plazas.map((p: { id: string }) => p.id), [plazaA.id]);
  });

  it("an admin can still process a toll at any plaza", async () => {
    assert.equal((await processToll(staff.admin.token, plazaA.id)).status, 201);
    assert.equal((await processToll(staff.admin.token, plazaB.id)).status, 201);
  });
});