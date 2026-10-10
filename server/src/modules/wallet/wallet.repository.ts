import { randomUUID } from "node:crypto";
import { prisma } from "../../config/database.js";

type LedgerType = "TOP_UP" | "TOLL_DEBIT" | "REFUND" | "ADJUSTMENT";

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
};