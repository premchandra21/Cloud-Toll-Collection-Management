// Integration tests for pay-later (toll on credit) at POST /api/v1/toll-transactions/process.
// Run:  npm test   (from server/)
//
// Same approach as toll.test.ts: real API + real database, every driver/plaza is created here
// with unique names and removed in after(). Needs the seed (operator@toll.test is used to log in).
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { app } from "../../app.js";
import { prisma } from "../../config/database.js";
import { reconciliationRepository } from "../reports/reconciliation.repository.js";

const RUN = randomUUID().slice(0, 8).toUpperCase();

let server: Server;
let baseUrl = "";
let operatorToken = "";
let plazaId = "";

const userIds: string[] = [];

async function login(email: string, password: string) {
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { data: { token: string } };
  return body.data.token;
}

async function processToll(rfidTag: string, idempotencyKey = randomUUID()) {
  const res = await fetch(`${baseUrl}/api/v1/toll-transactions/process`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({ rfidTag, plazaId, idempotencyKey }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = (await res.json()) as any;
  return { status: res.status, json };
}

let counter = 0;
async function makeDriver(balance: string, creditLimit: string, monthlyCreditLimit: string) {
  counter += 1;
  const tag = `C${RUN}-${counter}`;
  const user = await prisma.user.create({
    data: { name: `Credit Driver ${tag}`, email: `${tag.toLowerCase()}@test.local`, passwordHash: "not-used" },
  });
  userIds.push(user.id);

  const wallet = await prisma.wallet.create({
    data: { userId: user.id, balance, creditLimit, monthlyCreditLimit },
  });
  if (Number(balance) > 0) {
    await prisma.walletTransaction.create({
      data: { walletId: wallet.id, type: "TOP_UP", amount: balance, balanceAfter: balance, referenceType: "TEST" },
    });
  }
  const vehicle = await prisma.vehicle.create({
    data: { userId: user.id, vehicleNumber: `CRD${RUN}${counter}`, vehicleType: "CAR", rfidTag: tag },
  });
  return { userId: user.id, walletId: wallet.id, vehicleId: vehicle.id, rfidTag: tag };
}

async function state(walletId: string) {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: walletId } });
  const sum = await prisma.walletTransaction.aggregate({ where: { walletId }, _sum: { amount: true } });
  const debits = await prisma.walletTransaction.count({ where: { walletId, type: "TOLL_DEBIT" } });
  return { balance: wallet.balance.toFixed(2), ledgerSum: Number(sum._sum.amount ?? 0).toFixed(2), debits };
}

before(async () => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  operatorToken = await login("operator@toll.test", "Operator@123");

  const plaza = await prisma.tollPlaza.create({
    data: { name: `Credit Plaza ${RUN}`, code: `K${RUN}`, location: "Test road" },
  });
  plazaId = plaza.id;
  const operator = await prisma.user.findUniqueOrThrow({ where: { email: "operator@toll.test" } });
  await prisma.operatorPlaza.create({ data: { userId: operator.id, plazaId } });
  await prisma.tollRate.create({ data: { plazaId, vehicleType: "CAR", amount: "80.00" } });
});

after(async () => {
  const vehicles = await prisma.vehicle.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const vehicleIds = vehicles.map((v) => v.id);
  await prisma.tollTransaction.deleteMany({ where: { OR: [{ vehicleId: { in: vehicleIds } }, { plazaId }] } });
  await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: { in: userIds } } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.vehicle.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.tollRate.deleteMany({ where: { plazaId } });
  await prisma.tollPlaza.deleteMany({ where: { id: plazaId } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("toll on credit (pay later)", () => {
  it("short wallet + credit available: vehicle passes, wallet NOT charged, no ledger row, due date set", async () => {
    const d = await makeDriver("30.00", "300.00", "600.00");
    const before = Date.now();

    const { status, json } = await processToll(d.rfidTag);

    assert.equal(status, 201);
    assert.equal(json.data.status, "SUCCESS");
    assert.equal(json.data.amount, "80.00");
    assert.equal(json.data.remainingBalance, "30.00", "wallet untouched");
    assert.ok(json.data.credit, "result says it was passed on credit");
    assert.equal(json.data.credit.outstanding, "80.00");
    assert.equal(json.data.credit.limit, "300.00");
    const days = (new Date(json.data.credit.dueAt).getTime() - before) / 86_400_000;
    assert.ok(days > 6.9 && days < 7.1, `due about 7 days out (got ${days.toFixed(2)})`);

    const s = await state(d.walletId);
    assert.equal(s.balance, "30.00");
    assert.equal(s.debits, 0, "no TOLL_DEBIT until the toll is settled");
    assert.equal(s.ledgerSum, s.balance, "ledger still equals balance");

    const row = await prisma.tollTransaction.findUniqueOrThrow({ where: { id: json.data.transactionId } });
    assert.equal(row.onCredit, true);
    assert.equal(row.settledAt, null);

    const notes = await prisma.notification.findMany({ where: { userId: d.userId } });
    assert.deepEqual(notes.map((n) => n.type), ["CREDIT_USED"]);
  });

  it("a wallet that can pay is charged normally even when it has a pay-later facility", async () => {
    const d = await makeDriver("500.00", "300.00", "600.00");
    const { json } = await processToll(d.rfidTag);
    assert.equal(json.data.status, "SUCCESS");
    assert.equal(json.data.credit, null);
    assert.equal(json.data.remainingBalance, "420.00");
    assert.equal((await state(d.walletId)).debits, 1);
  });

  it("credit limit: passes while unpaid credit stays within the limit, then FAILED CREDIT_LIMIT_EXCEEDED", async () => {
    const d = await makeDriver("0.00", "200.00", "1000.00"); // room for 2 x 80 = 160, third would be 240
    assert.equal((await processToll(d.rfidTag)).json.data.credit.outstanding, "80.00");
    assert.equal((await processToll(d.rfidTag)).json.data.credit.outstanding, "160.00");

    const third = await processToll(d.rfidTag);
    assert.equal(third.status, 201);
    assert.equal(third.json.data.status, "FAILED");
    assert.equal(third.json.data.failureReason, "CREDIT_LIMIT_EXCEEDED");
    assert.equal(third.json.data.credit, null);

    const notes = await prisma.notification.findMany({ where: { userId: d.userId, type: "TOLL_FAILED" } });
    assert.equal(notes.length, 1);
    assert.equal((await state(d.walletId)).balance, "0.00");
  });

  it("monthly limit: FAILED CREDIT_MONTHLY_LIMIT_EXCEEDED even though the credit limit has room", async () => {
    const d = await makeDriver("0.00", "1000.00", "160.00");
    assert.equal((await processToll(d.rfidTag)).json.data.status, "SUCCESS");
    assert.equal((await processToll(d.rfidTag)).json.data.status, "SUCCESS");

    const third = await processToll(d.rfidTag);
    assert.equal(third.json.data.status, "FAILED");
    assert.equal(third.json.data.failureReason, "CREDIT_MONTHLY_LIMIT_EXCEEDED");
  });

  it("monthly limit counts credit already settled (borrow-pay-borrow does not reset it)", async () => {
    const d = await makeDriver("0.00", "1000.00", "160.00");
    const a = await processToll(d.rfidTag);
    const b = await processToll(d.rfidTag);
    // pretend both were paid: settledAt set, so nothing is outstanding any more
    await prisma.tollTransaction.updateMany({
      where: { id: { in: [a.json.data.transactionId, b.json.data.transactionId] } },
      data: { settledAt: new Date() },
    });
    const third = await processToll(d.rfidTag);
    assert.equal(third.json.data.failureReason, "CREDIT_MONTHLY_LIMIT_EXCEEDED");
  });

  it("overdue dues block pay-later: FAILED CREDIT_OVERDUE", async () => {
    const d = await makeDriver("0.00", "1000.00", "1000.00");
    const first = await processToll(d.rfidTag);
    assert.equal(first.json.data.status, "SUCCESS");

    await prisma.tollTransaction.update({
      where: { id: first.json.data.transactionId },
      data: { creditDueAt: new Date(Date.now() - 86_400_000) }, // due yesterday
    });

    const next = await processToll(d.rfidTag);
    assert.equal(next.json.data.status, "FAILED");
    assert.equal(next.json.data.failureReason, "CREDIT_OVERDUE");
  });

  it("no facility (limits 0, or only one limit set): FAILED INSUFFICIENT_BALANCE as before", async () => {
    const none = await makeDriver("0.00", "0.00", "0.00");
    const half = await makeDriver("0.00", "500.00", "0.00");
    for (const d of [none, half]) {
      const { json } = await processToll(d.rfidTag);
      assert.equal(json.data.status, "FAILED");
      assert.equal(json.data.failureReason, "INSUFFICIENT_BALANCE");
    }
  });

  it("same idempotencyKey twice on a credit toll: one row, second call is a replay and still shows credit", async () => {
    const d = await makeDriver("0.00", "300.00", "600.00");
    const key = randomUUID();
    const first = await processToll(d.rfidTag, key);
    const second = await processToll(d.rfidTag, key);

    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.json.data.idempotentReplay, true);
    assert.equal(second.json.data.transactionId, first.json.data.transactionId);
    assert.ok(second.json.data.credit);
    assert.equal(await prisma.tollTransaction.count({ where: { idempotencyKey: key } }), 1);
  });

  it("20 parallel tolls on a wallet with credit for exactly 5: 5 on credit, 15 FAILED, outstanding never above the limit", async () => {
    const d = await makeDriver("0.00", "400.00", "10000.00"); // 5 x 80.00

    const results = await Promise.all(Array.from({ length: 20 }, () => processToll(d.rfidTag)));

    const ok = results.filter((r) => r.json.data?.status === "SUCCESS");
    const failed = results.filter((r) => r.json.data?.status === "FAILED");
    assert.equal(ok.length, 5);
    assert.equal(failed.length, 15);
    assert.ok(failed.every((r) => r.json.data.failureReason === "CREDIT_LIMIT_EXCEEDED"));

    const outstanding = await prisma.tollTransaction.aggregate({
      where: { vehicleId: d.vehicleId, onCredit: true, settledAt: null },
      _sum: { amount: true },
    });
    assert.equal(Number(outstanding._sum.amount).toFixed(2), "400.00");
    const s = await state(d.walletId);
    assert.equal(s.balance, "0.00");
    assert.equal(s.debits, 0);
  });

  it("reconciliation does not flag an open credit toll as missing its debit", async () => {
    const d = await makeDriver("0.00", "300.00", "600.00");
    const countBefore = (await reconciliationRepository.tollLedgerCounts()).withoutMatchingDebit;

    const { json } = await processToll(d.rfidTag);
    assert.equal(json.data.status, "SUCCESS");

    const after = await reconciliationRepository.tollLedgerCounts();
    assert.equal(after.withoutMatchingDebit, countBefore, "an open credit toll is owed, not missing");
    const mismatches = await reconciliationRepository.findWalletMismatches();
    assert.ok(!mismatches.some((m) => m.walletId === d.walletId));
  });
});