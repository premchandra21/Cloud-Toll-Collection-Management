// Integration tests for the second half of pay-later: paying the dues, the wallet credit summary,
// admin-set limits, reminders, the dashboard collected/outstanding split and the reconciliation check.
// Run:  npm test   (from server/)
//
// Real API + real database. Every driver/plaza is created here and removed in after().
// Needs the seed (operator@toll.test is used to log in and process tolls).
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { app } from "../../app.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { dashboardRepository } from "../dashboard/dashboard.repository.js";
import { reconciliationRepository } from "../reports/reconciliation.repository.js";
import { creditService } from "./credit.service.js";

const RUN = randomUUID().slice(0, 8).toUpperCase();

let server: Server;
let baseUrl = "";
let operatorToken = "";
let adminToken = "";
let plazaId = "";

const userIds: string[] = [];
const sign = (id: string, role: string) => jwt.sign({ role }, env.JWT_SECRET, { subject: id, expiresIn: "1h" });

async function api(method: string, path: string, token: string, body?: unknown) {
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = (await res.json()) as any;
  return { status: res.status, json };
}

const processToll = (rfidTag: string) =>
  api("POST", "/toll-transactions/process", operatorToken, {
    rfidTag,
    plazaId,
    idempotencyKey: randomUUID(),
  });

let counter = 0;
async function makeDriver(balance: string, creditLimit: string, monthlyCreditLimit: string) {
  counter += 1;
  const tag = `S${RUN}-${counter}`;
  const user = await prisma.user.create({
    data: { name: `Settle Driver ${tag}`, email: `${tag.toLowerCase()}@test.local`, passwordHash: "not-used" },
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
    data: { userId: user.id, vehicleNumber: `STL${RUN}${counter}`, vehicleType: "CAR", rfidTag: tag },
  });
  return { userId: user.id, walletId: wallet.id, vehicleId: vehicle.id, rfidTag: tag, token: sign(user.id, "USER") };
}

async function addBalance(d: { walletId: string }, amount: string) {
  const w = await prisma.wallet.update({ where: { id: d.walletId }, data: { balance: { increment: amount } } });
  await prisma.walletTransaction.create({
    data: { walletId: d.walletId, type: "TOP_UP", amount, balanceAfter: w.balance, referenceType: "TEST" },
  });
}

async function ledger(walletId: string) {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: walletId } });
  const sum = await prisma.walletTransaction.aggregate({ where: { walletId }, _sum: { amount: true } });
  const debits = await prisma.walletTransaction.findMany({
    where: { walletId, type: "TOLL_DEBIT" },
    select: { amount: true, referenceId: true },
  });
  return { balance: wallet.balance.toFixed(2), sum: Number(sum._sum.amount ?? 0).toFixed(2), debits };
}

before(async () => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "operator@toll.test", password: "Operator@123" }),
  });
  operatorToken = ((await login.json()) as { data: { token: string } }).data.token;

  const admin = await prisma.user.create({
    data: { name: `Settle Admin ${RUN}`, email: `settle-admin-${RUN.toLowerCase()}@test.local`, passwordHash: "not-used", role: "ADMIN" },
  });
  userIds.push(admin.id);
  adminToken = sign(admin.id, "ADMIN");

  const plaza = await prisma.tollPlaza.create({
    data: { name: `Settle Plaza ${RUN}`, code: `T${RUN}`, location: "Test road" },
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

describe("wallet credit summary and dues", () => {
  it("GET /wallet shows the pay-later position after two credit tolls", async () => {
    const d = await makeDriver("0.00", "300.00", "600.00");
    await processToll(d.rfidTag);
    await processToll(d.rfidTag);

    const { status, json } = await api("GET", "/wallet", d.token);
    assert.equal(status, 200);
    const c = json.data.wallet.credit;
    assert.equal(c.enabled, true);
    assert.equal(c.limit, "300.00");
    assert.equal(c.monthlyLimit, "600.00");
    assert.equal(c.outstanding, "160.00");
    assert.equal(c.usedThisMonth, "160.00");
    assert.equal(c.available, "140.00", "min(300-160, 600-160)");
    assert.equal(c.hasOverdue, false);
    assert.equal(c.overdueAmount, "0.00");
    assert.equal(c.dueDays, env.CREDIT_DUE_DAYS);
    const days = (new Date(c.nextDueAt).getTime() - Date.now()) / 86_400_000;
    assert.ok(days > env.CREDIT_DUE_DAYS - 0.1 && days < env.CREDIT_DUE_DAYS + 0.1, `nextDueAt ~${env.CREDIT_DUE_DAYS}d out`);
  });

  it("a wallet without the facility reports enabled:false and 0 available", async () => {
    const d = await makeDriver("100.00", "0.00", "0.00");
    const { json } = await api("GET", "/wallet", d.token);
    assert.equal(json.data.wallet.credit.enabled, false);
    assert.equal(json.data.wallet.credit.available, "0.00");
  });

  it("available is 0 while anything is overdue, and the overdue amount is shown", async () => {
    const d = await makeDriver("0.00", "500.00", "1000.00");
    const first = await processToll(d.rfidTag);
    await processToll(d.rfidTag);
    await prisma.tollTransaction.update({
      where: { id: first.json.data.transactionId },
      data: { creditDueAt: new Date(Date.now() - 86_400_000) },
    });

    const { json } = await api("GET", "/wallet", d.token);
    const c = json.data.wallet.credit;
    assert.equal(c.hasOverdue, true);
    assert.equal(c.overdueAmount, "80.00");
    assert.equal(c.overdueCount, 1);
    assert.equal(c.outstanding, "160.00");
    assert.equal(c.available, "0.00");
  });

  it("GET /wallet/credit/dues lists open dues, most urgent first, with an overdue flag", async () => {
    const d = await makeDriver("0.00", "500.00", "1000.00");
    const a = await processToll(d.rfidTag);
    const b = await processToll(d.rfidTag);
    await prisma.tollTransaction.update({
      where: { id: b.json.data.transactionId },
      data: { creditDueAt: new Date(Date.now() - 3_600_000) }, // b is now the most urgent and overdue
    });

    const { status, json } = await api("GET", "/wallet/credit/dues", d.token);
    assert.equal(status, 200);
    assert.equal(json.data.totalOutstanding, "160.00");
    assert.deepEqual(
      json.data.dues.map((x: { id: string }) => x.id),
      [b.json.data.transactionId, a.json.data.transactionId],
    );
    assert.equal(json.data.dues[0].overdue, true);
    assert.equal(json.data.dues[1].overdue, false);
    assert.equal(json.data.dues[0].amount, "80.00");
    assert.equal(json.data.dues[0].plaza.name, `Settle Plaza ${RUN}`);
  });

  it("only drivers can use the pay-later wallet endpoints", async () => {
    assert.equal((await api("GET", "/wallet/credit/dues", operatorToken)).status, 403);
    assert.equal((await api("POST", "/wallet/credit/settle", adminToken)).status, 403);
  });
});

describe("POST /wallet/credit/settle (pay my dues)", () => {
  it("pays every due: wallet debited, one negative ledger row per toll, tolls stamped settled", async () => {
    const d = await makeDriver("0.00", "500.00", "1000.00");
    const t1 = await processToll(d.rfidTag);
    const t2 = await processToll(d.rfidTag);
    await addBalance(d, "300.00");

    const { status, json } = await api("POST", "/wallet/credit/settle", d.token);
    assert.equal(status, 201);
    assert.equal(json.data.settledCount, 2);
    assert.equal(json.data.settledAmount, "160.00");
    assert.equal(json.data.balance, "140.00");
    assert.deepEqual(json.data.remaining, { count: 0, amount: "0.00" });

    const l = await ledger(d.walletId);
    assert.equal(l.balance, "140.00");
    assert.equal(l.sum, l.balance, "ledger still equals balance");
    assert.equal(l.debits.length, 2);
    assert.ok(l.debits.every((x) => x.amount.toString() === "-80"));
    const refs = l.debits.map((x) => x.referenceId).sort();
    assert.deepEqual(refs, [t1.json.data.transactionId, t2.json.data.transactionId].sort());

    const rows = await prisma.tollTransaction.findMany({ where: { vehicleId: d.vehicleId } });
    assert.ok(rows.every((r) => r.settledAt !== null && r.onCredit));

    const notes = await prisma.notification.findMany({ where: { userId: d.userId, type: "CREDIT_SETTLED" } });
    assert.equal(notes.length, 1);

    const summary = (await api("GET", "/wallet", d.token)).json.data.wallet;
    assert.equal(summary.credit.outstanding, "0.00");
    assert.equal(summary.credit.nextDueAt, null);
    assert.equal(summary.totalSpentOnTolls, "160.00");
  });

  it("pays as many whole dues as the balance covers, oldest first, and leaves the rest", async () => {
    const d = await makeDriver("0.00", "500.00", "1000.00");
    const t1 = await processToll(d.rfidTag);
    const t2 = await processToll(d.rfidTag);
    const t3 = await processToll(d.rfidTag);
    await addBalance(d, "170.00"); // covers two of three

    const { status, json } = await api("POST", "/wallet/credit/settle", d.token);
    assert.equal(status, 201);
    assert.equal(json.data.settledCount, 2);
    assert.equal(json.data.settledAmount, "160.00");
    assert.equal(json.data.balance, "10.00");
    assert.deepEqual(json.data.remaining, { count: 1, amount: "80.00" });
    assert.deepEqual(
      json.data.settled.map((x: { id: string }) => x.id),
      [t1.json.data.transactionId, t2.json.data.transactionId],
    );
    const third = await prisma.tollTransaction.findUniqueOrThrow({ where: { id: t3.json.data.transactionId } });
    assert.equal(third.settledAt, null);
  });

  it("balance below the oldest due: 409 INSUFFICIENT_BALANCE and nothing changes", async () => {
    const d = await makeDriver("0.00", "500.00", "1000.00");
    await processToll(d.rfidTag);
    await addBalance(d, "50.00");

    const { status, json } = await api("POST", "/wallet/credit/settle", d.token);
    assert.equal(status, 409);
    assert.equal(json.error.code, "INSUFFICIENT_BALANCE");
    assert.match(json.error.message, /at least ₹30\.00/);

    const l = await ledger(d.walletId);
    assert.equal(l.balance, "50.00");
    assert.equal(l.debits.length, 0);
    assert.equal(await prisma.tollTransaction.count({ where: { vehicleId: d.vehicleId, settledAt: { not: null } } }), 0);
  });

  it("nothing owed: 409 NO_CREDIT_DUE", async () => {
    const d = await makeDriver("100.00", "500.00", "1000.00");
    const { status, json } = await api("POST", "/wallet/credit/settle", d.token);
    assert.equal(status, 409);
    assert.equal(json.error.code, "NO_CREDIT_DUE");
  });

  it("paying the dues restores pay-later: a driver at the limit can pass again", async () => {
    const d = await makeDriver("0.00", "160.00", "10000.00");
    await processToll(d.rfidTag);
    await processToll(d.rfidTag);
    assert.equal((await processToll(d.rfidTag)).json.data.failureReason, "CREDIT_LIMIT_EXCEEDED");

    await addBalance(d, "200.00");
    assert.equal((await api("POST", "/wallet/credit/settle", d.token)).status, 201); // balance 40.00

    const again = await processToll(d.rfidTag); // 40 < 80, so it goes on credit again
    assert.equal(again.json.data.status, "SUCCESS");
    assert.ok(again.json.data.credit);
    assert.equal(again.json.data.credit.outstanding, "80.00");
  });

  it("paying overdue dues lifts the overdue block", async () => {
    const d = await makeDriver("0.00", "1000.00", "10000.00");
    const first = await processToll(d.rfidTag);
    await prisma.tollTransaction.update({
      where: { id: first.json.data.transactionId },
      data: { creditDueAt: new Date(Date.now() - 86_400_000) },
    });
    assert.equal((await processToll(d.rfidTag)).json.data.failureReason, "CREDIT_OVERDUE");

    await addBalance(d, "100.00");
    assert.equal((await api("POST", "/wallet/credit/settle", d.token)).status, 201);

    const next = await processToll(d.rfidTag);
    assert.equal(next.json.data.status, "SUCCESS");
    assert.ok(next.json.data.credit);
  });

  it("5 parallel pay clicks: the dues are paid exactly once", async () => {
    const d = await makeDriver("0.00", "500.00", "1000.00");
    await processToll(d.rfidTag);
    await processToll(d.rfidTag);
    await addBalance(d, "1000.00");

    const results = await Promise.all(Array.from({ length: 5 }, () => api("POST", "/wallet/credit/settle", d.token)));

    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(results.filter((r) => r.status === 409 && r.json.error.code === "NO_CREDIT_DUE").length, 4);
    const l = await ledger(d.walletId);
    assert.equal(l.balance, "840.00", "charged once, not five times");
    assert.equal(l.debits.length, 2);
    assert.equal(l.sum, l.balance);
  });

  it("a toll and a settlement at the same moment keep the ledger consistent", async () => {
    const d = await makeDriver("0.00", "800.00", "10000.00");
    for (let i = 0; i < 3; i++) await processToll(d.rfidTag);
    await addBalance(d, "500.00");

    await Promise.all([
      api("POST", "/wallet/credit/settle", d.token),
      processToll(d.rfidTag),
      processToll(d.rfidTag),
    ]);

    const l = await ledger(d.walletId);
    assert.equal(l.sum, l.balance, "ledger equals balance after the race");
    assert.ok(Number(l.balance) >= 0);
    const mismatches = await reconciliationRepository.findWalletMismatches();
    assert.ok(!mismatches.some((m) => m.walletId === d.walletId));
  });
});

describe("PUT /users/:id/credit (admin sets limits)", () => {
  it("sets both limits and the user list shows them with the outstanding amount", async () => {
    const d = await makeDriver("0.00", "0.00", "0.00");
    const set = await api("PUT", `/users/${d.userId}/credit`, adminToken, { creditLimit: 250, monthlyCreditLimit: "500.50" });
    assert.equal(set.status, 200);
    assert.deepEqual(set.json.data.user.credit, {
      enabled: true,
      limit: "250.00",
      monthlyLimit: "500.50",
      outstanding: "0.00",
    });

    await processToll(d.rfidTag); // now it can pass on credit
    const list = await api("GET", `/users?q=${encodeURIComponent(`S${RUN}-${counter}`.toLowerCase())}`, adminToken);
    const row = list.json.data.users.find((u: { id: string }) => u.id === d.userId);
    assert.equal(row.credit.outstanding, "80.00");
    assert.equal(row.credit.enabled, true);
  });

  it("0 / 0 turns pay-later off again", async () => {
    const d = await makeDriver("0.00", "300.00", "600.00");
    const off = await api("PUT", `/users/${d.userId}/credit`, adminToken, { creditLimit: "0", monthlyCreditLimit: "0" });
    assert.equal(off.status, 200);
    assert.equal(off.json.data.user.credit.enabled, false);
    const { json } = await processToll(d.rfidTag);
    assert.equal(json.data.status, "FAILED");
    assert.equal(json.data.failureReason, "INSUFFICIENT_BALANCE");
  });

  it("rejects a half-set pair, bad amounts and non-drivers", async () => {
    const d = await makeDriver("0.00", "0.00", "0.00");
    const half = await api("PUT", `/users/${d.userId}/credit`, adminToken, { creditLimit: "300", monthlyCreditLimit: "0" });
    assert.equal(half.status, 400);
    assert.equal(half.json.error.code, "VALIDATION_ERROR");
    assert.equal((await api("PUT", `/users/${d.userId}/credit`, adminToken, { creditLimit: "-5", monthlyCreditLimit: "10" })).status, 400);
    assert.equal((await api("PUT", `/users/${d.userId}/credit`, adminToken, { creditLimit: "1.234", monthlyCreditLimit: "10" })).status, 400);
    assert.equal((await api("PUT", `/users/${d.userId}/credit`, adminToken, { creditLimit: "999999", monthlyCreditLimit: "10" })).status, 400);

    const adminId = (jwt.decode(adminToken) as { sub: string }).sub;
    const notDriver = await api("PUT", `/users/${adminId}/credit`, adminToken, { creditLimit: "10", monthlyCreditLimit: "10" });
    assert.equal(notDriver.status, 409);
    const missing = await api("PUT", `/users/${randomUUID()}/credit`, adminToken, { creditLimit: "10", monthlyCreditLimit: "10" });
    assert.equal(missing.status, 404);
  });

  it("is admin only", async () => {
    const d = await makeDriver("0.00", "0.00", "0.00");
    assert.equal((await api("PUT", `/users/${d.userId}/credit`, d.token, { creditLimit: "10", monthlyCreditLimit: "10" })).status, 403);
    assert.equal((await api("PUT", `/users/${d.userId}/credit`, operatorToken, { creditLimit: "10", monthlyCreditLimit: "10" })).status, 403);
  });
});

describe("reminders", () => {
  it("sends overdue and due-soon reminders once per day per driver", async () => {
    const overdue = await makeDriver("0.00", "500.00", "1000.00");
    const soon = await makeDriver("0.00", "500.00", "1000.00");
    const later = await makeDriver("0.00", "500.00", "1000.00");

    const a = await processToll(overdue.rfidTag);
    await prisma.tollTransaction.update({
      where: { id: a.json.data.transactionId },
      data: { creditDueAt: new Date(Date.now() - 86_400_000) },
    });
    const b = await processToll(soon.rfidTag);
    await prisma.tollTransaction.update({
      where: { id: b.json.data.transactionId },
      data: { creditDueAt: new Date(Date.now() + 3_600_000) }, // due in an hour
    });
    await processToll(later.rfidTag); // due in CREDIT_DUE_DAYS, outside the reminder window
    await prisma.notification.deleteMany({ where: { userId: { in: [overdue.userId, soon.userId, later.userId] } } });

    const only = { userIds: [overdue.userId, soon.userId, later.userId] };
    const first = await creditService.sendReminders(only);
    assert.deepEqual(first, { driversWithDues: 3, overdueSent: 1, dueSoonSent: 1 });

    const types = async (id: string) =>
      (await prisma.notification.findMany({ where: { userId: id } })).map((n) => n.type);
    assert.deepEqual(await types(overdue.userId), ["CREDIT_OVERDUE"]);
    assert.deepEqual(await types(soon.userId), ["CREDIT_DUE_SOON"]);
    assert.deepEqual(await types(later.userId), []);

    const second = await creditService.sendReminders(only);
    assert.deepEqual(second, { driversWithDues: 3, overdueSent: 0, dueSoonSent: 0 }, "no duplicates the same day");
  });

  it("a driver with nothing unpaid gets nothing", async () => {
    const d = await makeDriver("0.00", "500.00", "1000.00");
    const r = await creditService.sendReminders({ userIds: [d.userId] });
    assert.deepEqual(r, { driversWithDues: 0, overdueSent: 0, dueSoonSent: 0 });
  });

  it("POST /credit/reminders/run is admin only", async () => {
    const d = await makeDriver("0.00", "0.00", "0.00");
    assert.equal((await api("POST", "/credit/reminders/run", d.token)).status, 403);
    assert.equal((await api("POST", "/credit/reminders/run", operatorToken)).status, 403);
    const ok = await api("POST", "/credit/reminders/run", adminToken);
    assert.equal(ok.status, 200);
    assert.equal(typeof ok.json.data.overdueSent, "number");
  });
});

describe("dashboard and reconciliation", () => {
  it("dashboard splits revenue into collected and outstanding, and moves money across on settlement", async () => {
    // The plaza is shared by every test in this file, so measure CHANGES against a snapshot.
    const range = { from: null, to: null, plazaIds: [plazaId] };
    const cents = (v: string) => Math.round(Number(v) * 100);
    const delta = (now: string, then: string) => ((cents(now) - cents(then)) / 100).toFixed(2);
    const base = await dashboardRepository.totals(range);
    const basePlaza = (await dashboardRepository.byPlaza(range)).find((p) => p.id === plazaId)!;

    const d = await makeDriver("100.00", "500.00", "1000.00");
    await processToll(d.rfidTag); // balance 100 -> paid normally, 20 left
    await processToll(d.rfidTag); // 20 < 80 -> on credit
    await processToll(d.rfidTag); // on credit

    let t = await dashboardRepository.totals(range);
    assert.equal(delta(t.revenue, base.revenue), "240.00");
    assert.equal(delta(t.collected, base.collected), "80.00");
    assert.equal(delta(t.creditOutstanding, base.creditOutstanding), "160.00");
    const plaza = (await dashboardRepository.byPlaza(range)).find((p) => p.id === plazaId)!;
    assert.equal(delta(plaza.creditOutstanding, basePlaza.creditOutstanding), "160.00");

    await addBalance(d, "200.00");
    await api("POST", "/wallet/credit/settle", d.token);

    t = await dashboardRepository.totals(range);
    assert.equal(delta(t.revenue, base.revenue), "240.00", "revenue is unchanged by settlement");
    assert.equal(delta(t.collected, base.collected), "240.00", "the 160 moved from owed to collected");
    assert.equal(delta(t.creditOutstanding, base.creditOutstanding), "0.00");
  });

  it("creditOverdue counts only unpaid tolls past their due date", async () => {
    const d = await makeDriver("0.00", "500.00", "1000.00");
    const a = await processToll(d.rfidTag);
    await processToll(d.rfidTag);
    await prisma.tollTransaction.update({
      where: { id: a.json.data.transactionId },
      data: { creditDueAt: new Date(Date.now() - 86_400_000) },
    });
    const t = await dashboardRepository.totals({ from: null, to: null, plazaIds: [plazaId] });
    // other drivers in this file may also have overdue tolls at this plaza, so check it is at least ours
    assert.ok(Number(t.creditOverdue) >= 80);
  });

  it("the dashboard endpoint returns the new fields", async () => {
    const { status, json } = await api("GET", "/dashboard/summary", adminToken);
    assert.equal(status, 200);
    for (const k of ["collected", "creditOutstanding", "creditOverdue"]) {
      assert.match(json.data.totals[k], /^\d+\.\d{2}$/);
    }
  });

  it("reconciliation flags an UNPAID credit toll that already has a debit (and clears when removed)", async () => {
    const d = await makeDriver("0.00", "500.00", "1000.00");
    const t = await processToll(d.rfidTag);
    const before = (await reconciliationRepository.tollLedgerCounts()).openCreditWithDebit;

    const bad = await prisma.walletTransaction.create({
      data: {
        walletId: d.walletId,
        type: "TOLL_DEBIT",
        amount: "-80.00",
        balanceAfter: "0.00",
        referenceType: "TOLL_TRANSACTION",
        referenceId: t.json.data.transactionId,
      },
    });
    const during = (await reconciliationRepository.tollLedgerCounts()).openCreditWithDebit;
    assert.ok(during >= before + 1, "the double-charge risk is detected");

    await prisma.walletTransaction.delete({ where: { id: bad.id } });
    const after = (await reconciliationRepository.tollLedgerCounts()).openCreditWithDebit;
    assert.ok(after <= during - 1);
  });

  it("a settled credit toll has exactly one matching debit, so reconciliation stays clean for it", async () => {
    const d = await makeDriver("0.00", "500.00", "1000.00");
    await processToll(d.rfidTag);
    await addBalance(d, "100.00");
    await api("POST", "/wallet/credit/settle", d.token);

    const missing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT t."id"::text AS "id" FROM "toll_transactions" t
      WHERE t."vehicleId" = ${d.vehicleId}::uuid
        AND t."status" = 'SUCCESS'
        AND NOT (t."onCredit" = true AND t."settledAt" IS NULL)
        AND NOT EXISTS (
          SELECT 1 FROM "wallet_transactions" l
          WHERE l."type" = 'TOLL_DEBIT' AND l."referenceType" = 'TOLL_TRANSACTION'
            AND l."referenceId" = t."id"::text AND l."amount" = -t."amount"
        )
    `;
    assert.equal(missing.length, 0, "the settlement debit matches the toll exactly");
  });
});