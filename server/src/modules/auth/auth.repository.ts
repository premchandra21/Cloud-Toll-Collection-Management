import { prisma } from "../../config/database.js";

const publicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

export const authRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findPublicById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: publicSelect });
  },

  // Registration always creates a USER with an empty wallet (balance 0.00).
  createUser(data: { name: string; email: string; passwordHash: string }) {
    return prisma.user.create({
      data: { ...data, role: "USER", wallet: { create: {} } },
      select: publicSelect,
    });
  },
};