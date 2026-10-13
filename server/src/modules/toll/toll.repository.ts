import { prisma } from "../../config/database.js";

// Shape shared by every toll-transaction read (the list/detail endpoints in Slice 7 can reuse it).
const txSelect = {
  id: true,
  idempotencyKey: true,
  amount: true,
  status: true,
  failureReason: true,
  processedAt: true,
  plazaId: true,
  vehicle: {
    select: { id: true, userId: true, vehicleNumber: true, vehicleType: true, rfidTag: true },
  },
  plaza: { select: { id: true, name: true, code: true } },
} as const;

interface ExecuteTollInput {
  idempotencyKey: string;
  vehicleId: string;
  plazaId: string;
  rateId: string;
  walletId: string;
  amount: string; // "80.00" - money stays a string, never a float
}

interface NotificationInput {
  userId: string;
  type: "LOW_BALANCE" | "TOLL_SUCCESS" | "TOLL_FAILED";
  title: string;
  message: string;
}

export const tollRepository = {
  findByIdempotencyKey(idempotencyKey: string) {
    return prisma.tollTransaction.findUnique({ where: { idempotencyKey }, select: txSelect });
  },

  findVehicleByRfid(rfidTag: string) {
    return prisma.vehicle.findUnique({
      where: { rfidTag },
      select: { id: true, userId: true, vehicleNumber: true, vehicleType: true, isActive: true },
    });
  },

  findPlaza(id: string) {
    return prisma.tollPlaza.findUnique({
      where: { id },
      select: { id: true, name: true, code: true, isActive: true },
    });
  },

  findActiveRate(plazaId: string, vehicleType: "CAR" | "BUS" | "TRUCK" | "HEAVY_VEHICLE") {
    return prisma.tollRate.findFirst({
      where: { plazaId, vehicleType, isActive: true },
      select: { id: true, amount: true },
    });
  },

  findWalletByUserId(userId: string) {
    return prisma.wallet.findUnique({ where: { userId }, select: { id: true, balance: true } });
  },

  // Steps 8-12 of the spec flow in ONE database transaction:
  //   1) conditional debit (a single UPDATE ... WHERE balance >= amount)
  //   2) toll transaction row (SUCCESS, or FAILED when the debit matched no row)
  //   3) TOLL_DEBIT ledger row (SUCCESS only), stored NEGATIVE so SUM(ledger) == balance
  // If any insert throws (e.g. duplicate idempotencyKey) the debit rolls back with it.
  executeToll(input: ExecuteTollInput) {
    const { idempotencyKey, vehicleId, plazaId, rateId, walletId, amount } = input;

    return prisma.$transaction(
      async (tx) => {
        const { count } = await tx.wallet.updateMany({
          where: { id: walletId, balance: { gte: amount } },
          data: { balance: { decrement: amount } },
        });

        // We still hold the row lock after a successful debit, so this read is our own balance.
        const wallet = await tx.wallet.findUniqueOrThrow({
          where: { id: walletId },
          select: { balance: true },
        });

        if (count === 0) {
          const transaction = await tx.tollTransaction.create({
            data: {
              idempotencyKey,
              vehicleId,
              plazaId,
              rateId,
              amount,
              status: "FAILED",
              failureReason: "INSUFFICIENT_BALANCE",
            },
            select: txSelect,
          });
          return { transaction, balance: wallet.balance };
        }

        const transaction = await tx.tollTransaction.create({
          data: { idempotencyKey, vehicleId, plazaId, rateId, amount, status: "SUCCESS" },
          select: txSelect,
        });

        await tx.walletTransaction.create({
          data: {
            walletId,
            type: "TOLL_DEBIT",
            amount: `-${amount}`,
            balanceAfter: wallet.balance,
            referenceType: "TOLL_TRANSACTION",
            referenceId: transaction.id,
            description: `Toll at ${transaction.plaza.name} (${transaction.vehicle.vehicleNumber})`,
          },
        });

        return { transaction, balance: wallet.balance };
      },
      // Many requests can queue on one wallet row, so allow more than the 2s/5s defaults.
      { maxWait: 15_000, timeout: 30_000 },
    );
  },

  createNotifications(rows: NotificationInput[]) {
    return prisma.notification.createMany({ data: rows });
  },
};