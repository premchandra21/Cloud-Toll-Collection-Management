import { AppError } from "../../shared/errors/AppError.js";
import { pageMeta } from "../../shared/utils/pagination.js";
import { notificationRepository } from "./notification.repository.js";
import type { NotificationListQuery } from "./notification.schema.js";

export const notificationService = {
  async list(userId: string, query: NotificationListQuery) {
    const { rows, total, unreadCount } = await notificationRepository.list(userId, {
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      unreadOnly: query.unreadOnly ?? false,
    });
    return { items: rows, unreadCount, meta: pageMeta(query.page, query.pageSize, total) };
  },

  async markRead(id: string, userId: string) {
    const { count } = await notificationRepository.markRead(id, userId);
    if (count === 0) throw new AppError(404, "RESOURCE_NOT_FOUND", "Notification not found");
    return notificationRepository.findOwned(id, userId);
  },

  async markAllRead(userId: string) {
    const { count } = await notificationRepository.markAllRead(userId);
    return { updated: count };
  },
};