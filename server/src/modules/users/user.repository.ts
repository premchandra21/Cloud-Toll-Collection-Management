import { prisma } from "../../config/database.js";
import type { UserListQuery } from "./user.schema.js";

// passwordHash is deliberately never selected.
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  wallet: { select: { balance: true, creditLimit: true, monthlyCreditLimit: true } },
  _count: { select: { vehicles: true } },
  // Only operators have rows here (the plazas they may work at)
  operatorPlazas: {
    select: { plaza: { select: { id: true, name: true, code: true } } },
    orderBy: { plaza: { code: "asc" } },
  },
} as const;

export const userRepository = {
  async list(query: UserListQuery, opts: { skip: number; take: number }) {
    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.q
        ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" as const } },
            { email: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: opts.skip,
        take: opts.take,
      }),
      prisma.user.count({ where }),
    ]);
    return { rows, total };
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: userSelect });
  },

  countPlazas(ids: string[]) {
    return prisma.tollPlaza.count({ where: { id: { in: ids } } });
  },

  // Replace the operator's whole plaza set in one transaction, so there is never a moment
  // where they have half of the old set and half of the new one.
  async replacePlazas(userId: string, plazaIds: string[]) {
    await prisma.$transaction([
      prisma.operatorPlaza.deleteMany({ where: { userId } }),
      prisma.operatorPlaza.createMany({ data: plazaIds.map((plazaId) => ({ userId, plazaId })) }),
    ]);
    return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
  },

  // Unpaid pay-later amount per driver, for the given users only. One grouped query, aggregated in SQL.
  async creditOutstanding(userIds: string[]) {
    const map = new Map<string, string>();
    if (userIds.length === 0) return map;
    const rows = await prisma.$queryRaw<{ userId: string; outstanding: string }[]>`
      SELECT v."userId"::text AS "userId", SUM(t."amount")::numeric(14,2)::text AS "outstanding"
      FROM "toll_transactions" t
      JOIN "vehicles" v ON v."id" = t."vehicleId"
      WHERE t."onCredit" = true AND t."settledAt" IS NULL AND v."userId" = ANY(${userIds}::uuid[])
      GROUP BY v."userId"
    `;
    for (const r of rows) map.set(r.userId, r.outstanding);
    return map;
  },

  async setCreditLimits(userId: string, creditLimit: string, monthlyCreditLimit: string) {
    await prisma.wallet.update({ where: { userId }, data: { creditLimit, monthlyCreditLimit } });
    return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
  },

  setActive(id: string, isActive: boolean) {
    return prisma.user.update({ where: { id }, data: { isActive }, select: userSelect });
  },
};