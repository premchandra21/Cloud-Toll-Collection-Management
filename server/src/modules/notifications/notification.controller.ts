import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/responses/response.js";
import { notificationIdParamsSchema, notificationListQuerySchema } from "./notification.schema.js";
import { notificationService } from "./notification.service.js";

export async function listNotifications(req: Request, res: Response) {
  const query = notificationListQuerySchema.parse(req.query);
  const { items, unreadCount, meta } = await notificationService.list(req.user!.id, query);
  sendSuccess(res, { notifications: items, unreadCount }, "Notifications fetched", 200, meta);
}

export async function markNotificationRead(req: Request, res: Response) {
  const { id } = notificationIdParamsSchema.parse(req.params);
  const notification = await notificationService.markRead(id, req.user!.id);
  sendSuccess(res, { notification }, "Notification marked as read");
}

export async function markAllNotificationsRead(req: Request, res: Response) {
  const result = await notificationService.markAllRead(req.user!.id);
  sendSuccess(res, result, "All notifications marked as read");
}