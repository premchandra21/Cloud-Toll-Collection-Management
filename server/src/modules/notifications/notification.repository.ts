import { prisma } from "../../config/database.js";

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  message: true,
  isRead: true,
  createdAt: true,
} as const;

export const notificationRepository = {
  async list(userId: string, opts: { skip: number; take: number; unreadOnly: boolean }) {
    const where = { userId, ...(opts.unreadOnly ? { isRead: false } : {}) };
    const [rows, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        select: notificationSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: opts.skip,
        take: opts.take,
      }),
      prisma.notification.count({ where }),
      // Always the overall unread count (drives the bell badge), whatever filter is applied
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { rows, total, unreadCount };
  },

  // Scoped by userId inside the query itself, so another user's notification can never be touched.
  // updateMany's count is the number of MATCHED rows, so marking an already-read one still returns 1.
  markRead(id: string, userId: string) {
    return prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  },

  findOwned(id: string, userId: string) {
    return prisma.notification.findFirst({ where: { id, userId }, select: notificationSelect });
  },

  markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  },
};