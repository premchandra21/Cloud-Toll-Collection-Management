import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification.controller.js";

export const notificationRouter = Router();

// Notifications are created for drivers (vehicle owners). The user id always comes from the JWT.
notificationRouter.use(requireAuth, requireRole("USER"));

notificationRouter.get("/", listNotifications);
notificationRouter.patch("/read-all", markAllNotificationsRead);
notificationRouter.patch("/:id/read", markNotificationRead);