// Integration tests for POST /api/v1/toll-transactions/process (spec section 14).
// Run:  npm test   (from server/)
//
// They call the real API against the database in DATABASE_URL and need the seed data
// (operator@toll.test / Operator@123 and asha@toll.test / Driver@123 are used to log in).
// Every driver, vehicle and plaza the tests need is created here with unique names and
// removed again in after(), so your demo data is not touched.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { app } from "../../app.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";

const RUN = randomUUID().slice(0, 8).toUpperCase();

let server: Server;
let baseUrl = "";
let operatorToken = "";
let driverToken = "";
let plazaId = "";
let inactivePlazaId = "";

const userIds: string[] = [];
const plazaIds: string[] = [];

// ---------- helpers ----------

async function login(email: string, password: string) {
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { data: { token: string } };
  return body.data.token;
}

async function processToll(body: unknown, token = operatorToken) {
  const res = await fetch(`${baseUrl}/api/v1/toll-transactions/process`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = (await res.json()) as any;
  return { status: res.status, json };
}

let counter = 0;
async function makeDriver(
  balance: string,
  opts: { vehicleType?: "CAR" | "BUS" | "TRUCK" | "HEAVY_VEHICLE"; vehicleActive?: boolean } = {},
) {
  counter += 1;
  const tag = `T${RUN}-${counter}`;
  const user = await prisma.user.create({
    data: { name: `Test Driver ${tag}`, email: `${tag.toLowerCase()}@test.local`, passwordHash: "not-used" },
  });
  userIds.push(user.id);

  const wallet = await prisma.wallet.create({ data: { userId: user.id, balance } });
  // Opening balance as a ledger row, like the seed does, so the ledger invariant holds.
  await prisma.walletTransaction.create({
    data: { walletId: wallet.id, type: "TOP_UP", amount: balance, balanceAfter: balance, referenceType: "TEST" },
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      userId: user.id,
      vehicleNumber: `TST${RUN}${counter}`,
      vehicleType: opts.vehicleType ?? "CAR",
      rfidTag: tag,
      isActive: opts.vehicleActive ?? true,
    },
  });
  return { userId: user.id, walletId: wallet.id, vehicleId: vehicle.id, rfidTag: tag };
}

async function walletState(walletId: string) {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: walletId } });
  const sum = await prisma.walletTransaction.aggregate({ where: { walletId }, _sum: { amount: true } });
  const debits = await prisma.walletTransaction.findMany({ where: { walletId, type: "TOLL_DEBIT" } });
  return { balance: wallet.balance.toFixed(2), ledgerSum: (sum._sum.amount ?? 0).toString(), debits };
}

function assertReconciled(s: { balance: string; ledgerSum: string }) {
  assert.equal(Number(s.ledgerSum).toFixed(2), s.balance, "ledger sum must equal wallet balance");
}

// ---------- setup / teardown ----------

before(async () => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  operatorToken = await login("operator@toll.test", "Operator@123");
  driverToken = await login("asha@toll.test", "Driver@123");

  const plaza = await prisma.tollPlaza.create({
    data: { name: `Test Plaza ${RUN}`, code: `T${RUN}`, location: "Test road" },
  });
  const inactive = await prisma.tollPlaza.create({
    data: { name: `Inactive Plaza ${RUN}`, code: `X${RUN}`, location: "Test road", isActive: false },
  });
  plazaId = plaza.id;
  inactivePlazaId = inactive.id;
   plazaIds.push(plaza.id, inactive.id);

  // Operators may only work at assigned plazas, so assign the demo operator to the test plazas.
  // (The rows are removed automatically when the plazas are deleted in after().)
  const operator = await prisma.user.findUniqueOrThrow({ where: { email: "operator@toll.test" } });
  await prisma.operatorPlaza.createMany({
    data: plazaIds.map((id) => ({ userId: operator.id, plazaId: id })),
  });

  // Only CAR has a rate (80.00) on purpose: TRUCK is used for the "no rate" test.
  for (const id of plazaIds) {
    await prisma.tollRate.create({ data: { plazaId: id, vehicleType: "CAR", amount: "80.00" } });
  }
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
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.tollRate.deleteMany({ where: { plazaId: { in: plazaIds } } });
  await prisma.tollPlaza.deleteMany({ where: { id: { in: plazaIds } } });

  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

// ---------- tests ----------

describe("toll processing", () => {
  it("valid toll + enough balance: SUCCESS, wallet debited once, toll row + negative ledger row", async () => {
    const d = await makeDriver("500.00");
    const key = randomUUID();

    const { status, json } = await processToll({ rfidTag: d.rfidTag, plazaId, idempotencyKey: key });

    assert.equal(status, 201);
    assert.equal(json.data.status, "SUCCESS");
    assert.equal(json.data.amount, "80.00");
    assert.equal(json.data.remainingBalance, "420.00");
    assert.equal(json.data.idempotentReplay, false);

    const s = await walletState(d.walletId);
    assert.equal(s.balance, "420.00");
    assert.equal(s.debits.length, 1);
    assert.equal(s.debits[0]!.amount.toFixed(2), "-80.00");
    assert.equal(s.debits[0]!.balanceAfter.toFixed(2), "420.00");
    assert.equal(s.debits[0]!.referenceId, json.data.transactionId);
    assertReconciled(s);

    const rows = await prisma.tollTransaction.count({ where: { idempotencyKey: key } });
    assert.equal(rows, 1);
  });

  it("RFID is matched case-insensitively (same normalisation as vehicle registration)", async () => {
    const d = await makeDriver("500.00");
    const { status, json } = await processToll({
      rfidTag: `  ${d.rfidTag.toLowerCase()} `,
      plazaId,
      idempotencyKey: randomUUID(),
    });
    assert.equal(status, 201);
    assert.equal(json.data.status, "SUCCESS");
  });

  it("insufficient balance: FAILED row, no debit, no ledger row, balance unchanged", async () => {
    const d = await makeDriver("50.00");

    const { status, json } = await processToll({
      rfidTag: d.rfidTag,
      plazaId,
      idempotencyKey: randomUUID(),
    });

    assert.equal(status, 201);
    assert.equal(json.data.status, "FAILED");
    assert.equal(json.data.failureReason, "INSUFFICIENT_BALANCE");
    assert.equal(json.data.remainingBalance, "50.00");

    const s = await walletState(d.walletId);
    assert.equal(s.balance, "50.00");
    assert.equal(s.debits.length, 0);
    assertReconciled(s);

    const notes = await prisma.notification.findMany({ where: { userId: d.userId } });
    assert.deepEqual(notes.map((n) => n.type), ["TOLL_FAILED"]);
  });

  it("balance exactly equal to the toll is enough (balance >= amount)", async () => {
    const d = await makeDriver("80.00");
    const { json } = await processToll({ rfidTag: d.rfidTag, plazaId, idempotencyKey: randomUUID() });
    assert.equal(json.data.status, "SUCCESS");
    assert.equal(json.data.remainingBalance, "0.00");
  });

  it("same idempotencyKey twice: one debit, existing transaction returned", async () => {
    const d = await makeDriver("500.00");
    const body = { rfidTag: d.rfidTag, plazaId, idempotencyKey: randomUUID() };

    const first = await processToll(body);
    const second = await processToll(body);

    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.json.data.idempotentReplay, true);
    assert.equal(second.json.data.transactionId, first.json.data.transactionId);

    const s = await walletState(d.walletId);
    assert.equal(s.balance, "420.00");
    assert.equal(s.debits.length, 1);
  });

  it("idempotencyKey reused for a different event: 409 DUPLICATE_TRANSACTION, no new charge", async () => {
    const a = await makeDriver("500.00");
    const b = await makeDriver("500.00");
    const key = randomUUID();

    await processToll({ rfidTag: a.rfidTag, plazaId, idempotencyKey: key });
    const { status, json } = await processToll({ rfidTag: b.rfidTag, plazaId, idempotencyKey: key });

    assert.equal(status, 409);
    assert.equal(json.error.code, "DUPLICATE_TRANSACTION");
    assert.equal((await walletState(b.walletId)).balance, "500.00");
  });

  it("unknown RFID: 404 VEHICLE_NOT_FOUND, nothing stored", async () => {
    const key = randomUUID();
    const { status, json } = await processToll({ rfidTag: `NOPE-${RUN}`, plazaId, idempotencyKey: key });
    assert.equal(status, 404);
    assert.equal(json.error.code, "VEHICLE_NOT_FOUND");
    assert.equal(await prisma.tollTransaction.count({ where: { idempotencyKey: key } }), 0);
  });

  it("inactive vehicle: 409 VEHICLE_INACTIVE, no debit", async () => {
    const d = await makeDriver("500.00", { vehicleActive: false });
    const { status, json } = await processToll({ rfidTag: d.rfidTag, plazaId, idempotencyKey: randomUUID() });
    assert.equal(status, 409);
    assert.equal(json.error.code, "VEHICLE_INACTIVE");
    assert.equal((await walletState(d.walletId)).balance, "500.00");
  });

  it("inactive plaza: 409 PLAZA_INACTIVE, no debit", async () => {
    const d = await makeDriver("500.00");
    const { status, json } = await processToll({
      rfidTag: d.rfidTag,
      plazaId: inactivePlazaId,
      idempotencyKey: randomUUID(),
    });
    assert.equal(status, 409);
    assert.equal(json.error.code, "PLAZA_INACTIVE");
    assert.equal((await walletState(d.walletId)).balance, "500.00");
  });

  it("unknown plaza: 404", async () => {
    const d = await makeDriver("500.00");
    const { status, json } = await processToll({
      rfidTag: d.rfidTag,
      plazaId: randomUUID(),
      idempotencyKey: randomUUID(),
    });
    assert.equal(status, 404);
    assert.equal(json.error.code, "RESOURCE_NOT_FOUND");
  });

  it("no active rate for the vehicle type: 404 TOLL_RATE_NOT_FOUND, no debit", async () => {
    const d = await makeDriver("500.00", { vehicleType: "TRUCK" });
    const { status, json } = await processToll({ rfidTag: d.rfidTag, plazaId, idempotencyKey: randomUUID() });
    assert.equal(status, 404);
    assert.equal(json.error.code, "TOLL_RATE_NOT_FOUND");
    assert.equal((await walletState(d.walletId)).balance, "500.00");
  });

  it("malformed body: 400 VALIDATION_ERROR with field details", async () => {
    const { status, json } = await processToll({ rfidTag: "x", plazaId: "not-a-uuid", idempotencyKey: "short" });
    assert.equal(status, 400);
    assert.equal(json.error.code, "VALIDATION_ERROR");
    const fields = (json.error.details as { field: string }[]).map((d) => d.field).sort();
    assert.deepEqual(fields, ["idempotencyKey", "plazaId", "rfidTag"]);
  });

  it("a USER (driver) cannot process tolls: 403", async () => {
    const { status, json } = await processToll(
      { rfidTag: "RFID-0001", plazaId, idempotencyKey: randomUUID() },
      driverToken,
    );
    assert.equal(status, 403);
    assert.equal(json.error.code, "FORBIDDEN");
  });

  it("no token: 401", async () => {
    const res = await fetch(`${baseUrl}/api/v1/toll-transactions/process`, { method: "POST" });
    assert.equal(res.status, 401);
  });

  it("low balance after a successful toll creates TOLL_SUCCESS + LOW_BALANCE notifications", async () => {
    // 150 - 80 = 70, which is <= LOW_BALANCE_THRESHOLD (default 100)
    assert.ok(env.LOW_BALANCE_THRESHOLD >= 70, "this test assumes LOW_BALANCE_THRESHOLD >= 70");
    const d = await makeDriver("150.00");
    const { json } = await processToll({ rfidTag: d.rfidTag, plazaId, idempotencyKey: randomUUID() });
    assert.equal(json.data.status, "SUCCESS");
    assert.equal(json.data.lowBalance, true);

    const notes = await prisma.notification.findMany({ where: { userId: d.userId } });
    assert.deepEqual(notes.map((n) => n.type).sort(), ["LOW_BALANCE", "TOLL_SUCCESS"]);
  });
});

describe("concurrency", () => {
  it("50 parallel tolls (distinct keys) on a wallet that covers exactly 10: 10 SUCCESS, 40 FAILED, never negative", async () => {
    const d = await makeDriver("800.00"); // 10 x 80.00

    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
        processToll({ rfidTag: d.rfidTag, plazaId, idempotencyKey: randomUUID() }),
      ),
    );

    const statuses = results.map((r) => r.json.data?.status);
    assert.equal(statuses.filter((s) => s === "SUCCESS").length, 10);
    assert.equal(statuses.filter((s) => s === "FAILED").length, 40);

    const s = await walletState(d.walletId);
    assert.equal(s.balance, "0.00");
    assert.equal(s.debits.length, 10);
    assertReconciled(s);
  });

  it("same idempotencyKey sent 20 times in parallel: one transaction, one debit, same id in every response", async () => {
    const d = await makeDriver("500.00");
    const key = randomUUID();

    const results = await Promise.all(
      Array.from({ length: 20 }, () => processToll({ rfidTag: d.rfidTag, plazaId, idempotencyKey: key })),
    );

    assert.ok(results.every((r) => r.status === 200 || r.status === 201), "no request should error");
    const ids = new Set(results.map((r) => r.json.data.transactionId));
    assert.equal(ids.size, 1);
    assert.equal(results.filter((r) => r.status === 201).length, 1, "exactly one request creates it");

    assert.equal(await prisma.tollTransaction.count({ where: { idempotencyKey: key } }), 1);
    const s = await walletState(d.walletId);
    assert.equal(s.balance, "420.00");
    assert.equal(s.debits.length, 1);
    assertReconciled(s);
  });
});