import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { processToll } from "./toll.controller.js";
import {
  exportTransactions,
  getTransaction,
  listTransactions,
} from "./transaction.controller.js";

export const tollRouter = Router();

// JWT first, then role per route. Ownership for drivers is enforced inside the service.
tollRouter.use(requireAuth);

tollRouter.post("/process", requireRole("OPERATOR", "ADMIN"), processToll);

// Any role: a USER automatically only gets their own vehicles' tolls.
tollRouter.get("/", listTransactions);

// Gotcha: "/export" MUST be declared before "/:id" or Express treats "export" as an id.
tollRouter.get("/export", requireRole("OPERATOR", "ADMIN"), exportTransactions);

tollRouter.get("/:id", getTransaction);