import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { runReminders } from "./credit.controller.js";

export const creditRouter = Router();

creditRouter.use(requireAuth, requireRole("ADMIN"));

creditRouter.post("/reminders/run", runReminders);