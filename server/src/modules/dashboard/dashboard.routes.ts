import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { getSummary } from "./dashboard.controller.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth, requireRole("OPERATOR", "ADMIN"));

dashboardRouter.get("/summary", getSummary);