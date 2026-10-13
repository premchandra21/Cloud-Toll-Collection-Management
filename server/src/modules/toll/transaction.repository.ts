import { prisma } from "../../config/database.js";
import type { TransactionFilters } from "./transaction.schema.js";

// What every list / detail / export row contains. The owner is only exposed to staff by the service.
const txSelect = {
  id: true,
  idempotencyKey: true,
  amount: true,
  status: true,
  failureReason: true,
  processedAt: true,
  vehicle: {
    select: {
      id: true,
      userId: true,
      vehicleNumber: true,
      vehicleType: true,
      rfidTag: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
  plaza: { select: { id: true, name: true, code: true } },
} as const;

type Scope = { userId?: string }; // set for USER role: only their own vehicles' tolls

function buildWhere(filters: TransactionFilters, scope: Scope) {
  // Vehicle number is stored uppercase without spaces/hyphens, so normalise the search the same way.
  const vehicleNumberQuery = filters.q?.toUpperCase().replace(/[\s-]+/g, "");

  const vehicle = {
    ...(scope.userId ? { userId: scope.userId } : {}),
    ...(filters.vehicleType ? { vehicleType: filters.vehicleType } : {}),
    ...(filters.q
      ? {
          OR: [
            ...(vehicleNumberQuery
              ? [{ vehicleNumber: { contains: vehicleNumberQuery, mode: "insensitive" as const } }]
              : []),
            { rfidTag: { contains: filters.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.plazaId ? { plazaId: filters.plazaId } : {}),
    ...(filters.from || filters.to
      ? {
          processedAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lt: filters.to } : {}),
          },
        }
      : {}),
    ...(Object.keys(vehicle).length > 0 ? { vehicle } : {}),
  };
}

const newestFirst = [{ processedAt: "desc" as const }, { id: "desc" as const }];

export const transactionRepository = {
  async list(filters: TransactionFilters, scope: Scope, opts: { skip: number; take: number }) {
    const where = buildWhere(filters, scope);
    const [rows, total] = await Promise.all([
      prisma.tollTransaction.findMany({
        where,
        select: txSelect,
        orderBy: newestFirst,
        skip: opts.skip,
        take: opts.take,
      }),
      prisma.tollTransaction.count({ where }),
    ]);
    return { rows, total };
  },

  // Used by the CSV export. Capped so one request cannot pull the whole table.
  findForExport(filters: TransactionFilters, scope: Scope, limit: number) {
    return prisma.tollTransaction.findMany({
      where: buildWhere(filters, scope),
      select: txSelect,
      orderBy: newestFirst,
      take: limit,
    });
  },

  findById(id: string) {
    return prisma.tollTransaction.findUnique({ where: { id }, select: txSelect });
  },

  // The ledger row written in the same DB transaction as a SUCCESS toll holds the balance after it.
  // Filtering by the owner's wallet keeps this on the walletId index.
  findLedgerEntry(tollTransactionId: string, ownerUserId: string) {
    return prisma.walletTransaction.findFirst({
      where: {
        referenceType: "TOLL_TRANSACTION",
        referenceId: tollTransactionId,
        wallet: { userId: ownerUserId },
      },
      select: { balanceAfter: true },
    });
  },
};