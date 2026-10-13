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
  wallet: { select: { balance: true } },
  _count: { select: { vehicles: true } },
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

  setActive(id: string, isActive: boolean) {
    return prisma.user.update({ where: { id }, data: { isActive }, select: userSelect });
  },
};