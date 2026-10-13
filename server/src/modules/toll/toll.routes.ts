import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { processToll } from "./toll.controller.js";

export const tollRouter = Router();

// Slice 7 adds list / detail / CSV export here.
// Gotcha: declare "/export" BEFORE "/:id" or Express treats "export" as an id.
tollRouter.post("/process", requireAuth, requireRole("OPERATOR", "ADMIN"), processToll);