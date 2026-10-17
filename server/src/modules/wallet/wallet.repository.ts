import { randomUUID } from "node:crypto";
import { prisma } from "../../config/database.js";
import { fromCents, money, toCents } from "../../shared/utils/money.js";

type LedgerType = "TOP_UP" | "TOLL_DEBIT" | "REFUND" | "ADJUSTMENT";

const dueSelect = {
  id: true,
  amount: true,
  processedAt: true,
  creditDueAt: true,
  plaza: { select: { name: true, code: true } },
  vehicle: { select: { vehicleNumber: true } },
} as const;

export type SettleOutcome =
  | { kind: "NONE_DUE" }
  | { kind: "TOO_LOW"; balance: string; oldestDue: string }
  | {
      kind: "SETTLED";
      balance: string;
      settled: { id: string; amount: string; plaza: string; vehicleNumber: string }[];
      settledAmount: string;
      remainingCount: number;
      remainingAmount: string;
    };

export const walletRepository = {
  findByUserId(userId: string) {
    return prisma.wallet.findUnique({ where: { userId } });
  },

  totalsByType(walletId: string) {
    return prisma.walletTransaction.groupBy({
      by: ["type"],
      where: { walletId },
      _sum: { amount: true },
      _count: { _all: true },
    });
  },

  // Balance increase + ledger row in ONE transaction. The increment is a single atomic
  // UPDATE, and balanceAfter is read from the row it returned, so concurrent top-ups
  // can never record a stale balance.
  topUp(walletId: string, amount: string) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: walletId },
        data: { balance: { increment: amount } },
        select: { balance: true },
      });
      return tx.walletTransaction.create({
        data: {
          walletId,
          type: "TOP_UP",
          amount,
          balanceAfter: updated.balance,
          referenceType: "SIMULATED_PAYMENT",
          referenceId: `SIM-${randomUUID()}`,
          description: "Simulated wallet top-up",
        },
      });
    });
  },

  async listLedger(walletId: string, opts: { skip: number; take: number; type?: LedgerType }) {
    const where = { walletId, ...(opts.type ? { type: opts.type } : {}) };
    const [rows, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: opts.skip,
        take: opts.take,
      }),
      prisma.walletTransaction.count({ where }),
    ]);
    return { rows, total };
  },

  // Unpaid pay-later tolls of this driver, most urgent first. Bounded by the credit limit, so small.
  listOpenDues(userId: string) {
    return prisma.tollTransaction.findMany({
      where: { onCredit: true, settledAt: null, vehicle: { userId } },
      orderBy: [{ creditDueAt: "asc" }, { id: "asc" }],
      take: 200,
      select: dueSelect,
    });
  },

  // Pay the driver's pay-later dues from the wallet, most urgent first, as many WHOLE tolls as the
  // balance covers. One database transaction:
  //   - the wallet row is locked first, so two "pay" clicks (or a toll at the same moment) take turns
  //   - per toll: debit the wallet, write a negative TOLL_DEBIT ledger row that points at the toll
  //     (exactly what reconciliation expects), and stamp the toll settledAt
  // Nothing is written when the balance cannot cover even the first due.
  settleCredit(walletId: string, userId: string): Promise<SettleOutcome> {
    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "wallets" WHERE "id" = ${walletId}::uuid FOR UPDATE`;

        const dues = await tx.tollTransaction.findMany({
          where: { onCredit: true, settledAt: null, vehicle: { userId } },
          orderBy: [{ creditDueAt: "asc" }, { id: "asc" }],
          select: dueSelect,
        });
        if (dues.length === 0) return { kind: "NONE_DUE" as const };

        const start = await tx.wallet.findUniqueOrThrow({
          where: { id: walletId },
          select: { balance: true },
        });
        let balance = start.balance;
        const settled: { id: string; amount: string; plaza: string; vehicleNumber: string }[] = [];

        for (const due of dues) {
          if (balance.lt(due.amount)) break; // oldest-first: stop at the first one we cannot afford
          const updated = await tx.wallet.update({
            where: { id: walletId },
            data: { balance: { decrement: due.amount } },
            select: { balance: true },
          });
          balance = updated.balance;
          await tx.walletTransaction.create({
            data: {
              walletId,
              type: "TOLL_DEBIT",
              amount: `-${money(due.amount)}`,
              balanceAfter: balance,
              referenceType: "TOLL_TRANSACTION",
              referenceId: due.id,
              description: `Pay-later toll paid: ${due.plaza.name} (${due.vehicle.vehicleNumber})`,
            },
          });
          await tx.tollTransaction.update({ where: { id: due.id }, data: { settledAt: new Date() } });
          settled.push({
            id: due.id,
            amount: money(due.amount),
            plaza: due.plaza.name,
            vehicleNumber: due.vehicle.vehicleNumber,
          });
        }

        if (settled.length === 0) {
          return { kind: "TOO_LOW" as const, balance: money(balance), oldestDue: money(dues[0]!.amount) };
        }

        const remaining = dues.slice(settled.length);
        return {
          kind: "SETTLED" as const,
          balance: money(balance),
          settled,
          settledAmount: fromCents(settled.reduce((n, d) => n + toCents(d.amount), 0)),
          remainingCount: remaining.length,
          remainingAmount: fromCents(remaining.reduce((n, d) => n + toCents(d.amount), 0)),
        };
      },
      { maxWait: 15_000, timeout: 30_000 },
    );
  },

  createNotification(row: {
    userId: string;
    type: "CREDIT_SETTLED";
    title: string;
    message: string;
  }) {
    return prisma.notification.create({ data: row });
  },
};