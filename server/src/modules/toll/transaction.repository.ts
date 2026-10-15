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

// userId:   set for the USER role, only their own vehicles' tolls
// plazaIds: set for the OPERATOR role, only tolls recorded at these plazas (may be empty = nothing)
// Neither set (ADMIN): everything.
type Scope = { userId?: string; plazaIds?: string[] };

// The plaza filter from the request can only NARROW what the scope allows, never widen it.
function plazaCondition(filters: TransactionFilters, scope: Scope) {
  if (!scope.plazaIds) return filters.plazaId ? { plazaId: filters.plazaId } : {};
  if (filters.plazaId) {
    return scope.plazaIds.includes(filters.plazaId)
      ? { plazaId: filters.plazaId }
      : { plazaId: { in: [] as string[] } }; // asked for a plaza outside the scope: no rows
  }
  return { plazaId: { in: scope.plazaIds } };
}

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
    ...plazaCondition(filters, scope),
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