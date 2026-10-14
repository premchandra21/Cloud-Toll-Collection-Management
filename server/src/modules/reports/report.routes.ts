import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { getRevenueReport } from "./report.controller.js";

export const reportRouter = Router();

// GET /reports/reconciliation (ADMIN) is added in Slice 9 with the evidence scripts.
reportRouter.use(requireAuth, requireRole("OPERATOR", "ADMIN"));

reportRouter.get("/revenue", getRevenueReport);