import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { getReconciliation, getRevenueReport } from "./report.controller.js";

export const reportRouter = Router();

reportRouter.use(requireAuth, requireRole("OPERATOR", "ADMIN"));

reportRouter.get("/revenue", getRevenueReport);

// Ledger integrity check: ADMIN only (the router-level check above lets operators in for /revenue)
reportRouter.get("/reconciliation", requireRole("ADMIN"), getReconciliation);