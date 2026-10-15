// Integration tests for GET /reports/reconciliation (ADMIN only).
// Run:  npm test   (from server/)
//
// The "detects a mismatch" test deliberately writes a wallet whose balance disagrees with its ledger,
// checks the endpoint reports it, then removes it again. Tokens are signed directly (no passwords).
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { app } from "../../app.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";

const RUN = randomUUID().slice(0, 8).toLowerCase();

let server: Server;
let baseUrl = "";
const userIds: string[] = [];
const tokens = { admin: "", operator: "" };

async function makeUser(role: "ADMIN" | "OPERATOR" | "USER", name: string) {
  const user = await prisma.user.create({
    data: { name: `${name} ${RUN}`, email: `${name}-${RUN}@test.local`, passwordHash: "not-used", role },
  });
  userIds.push(user.id);
  return user;
}

const sign = (id: string, role: string) => jwt.sign({ role }, env.JWT_SECRET, { subject: id, expiresIn: "1h" });

async function reconcile(token: string) {
  const res = await fetch(`${baseUrl}/api/v1/reports/reconciliation`, { headers: { authorization: `Bearer ${token}` } });
  return { status: res.status, json: await res.json() };
}

before(async () => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  tokens.admin = sign((await makeUser("ADMIN", "recadmin")).id, "ADMIN");
  tokens.operator = sign((await makeUser("OPERATOR", "recop")).id, "OPERATOR");
});

after(async () => {
  await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: { in: userIds } } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("GET /reports/reconciliation", () => {
  it("is admin only: an operator gets 403 and no token gets 401", async () => {
    assert.equal((await reconcile(tokens.operator)).status, 403);
    const res = await fetch(`${baseUrl}/api/v1/reports/reconciliation`);
    assert.equal(res.status, 401);
  });

  it("reports ok for a wallet whose ledger adds up", async () => {
    const driver = await makeUser("USER", "recdriver-ok");
    const wallet = await prisma.wallet.create({ data: { userId: driver.id, balance: "70.00" } });
    await prisma.walletTransaction.createMany({
      data: [
        { walletId: wallet.id, type: "TOP_UP", amount: "100.00", balanceAfter: "100.00", referenceType: "TEST" },
        { walletId: wallet.id, type: "ADJUSTMENT", amount: "-30.00", balanceAfter: "70.00", referenceType: "TEST" },
      ],
    });

    const { status, json } = await reconcile(tokens.admin);
    assert.equal(status, 200);
    const emails = json.data.wallets.mismatches.map((m: { email: string }) => m.email);
    assert.ok(!emails.includes(driver.email), "a consistent wallet must not be listed");
    assert.ok(json.data.wallets.checked >= 1);
    assert.equal(typeof json.data.tolls.successTolls, "number");
  });

  it("detects a wallet whose balance does not match its ledger", async () => {
    const driver = await makeUser("USER", "recdriver-bad");
    // balance 50.00 but the ledger only adds up to 20.00: exactly the corruption this check exists for
    const wallet = await prisma.wallet.create({ data: { userId: driver.id, balance: "50.00" } });
    await prisma.walletTransaction.create({
      data: { walletId: wallet.id, type: "TOP_UP", amount: "20.00", balanceAfter: "20.00", referenceType: "TEST" },
    });

    const { status, json } = await reconcile(tokens.admin);
    assert.equal(status, 200);
    assert.equal(json.data.ok, false);
    const row = json.data.wallets.mismatches.find((m: { email: string }) => m.email === driver.email);
    assert.ok(row, "the bad wallet must be listed");
    assert.equal(row.balance, "50.00");
    assert.equal(row.ledgerSum, "20.00");
    assert.equal(row.difference, "30.00");
  });

  it("treats a wallet with no ledger rows as a ledger sum of 0", async () => {
    const driver = await makeUser("USER", "recdriver-empty");
    await prisma.wallet.create({ data: { userId: driver.id, balance: "5.00" } });

    const { json } = await reconcile(tokens.admin);
    const row = json.data.wallets.mismatches.find((m: { email: string }) => m.email === driver.email);
    assert.equal(row.ledgerSum, "0.00");
    assert.equal(row.difference, "5.00");
  });
});