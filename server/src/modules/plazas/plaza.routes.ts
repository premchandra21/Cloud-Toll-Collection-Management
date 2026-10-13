import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import {
  createPlaza,
  deactivateRate,
  listPlazas,
  setRate,
  updatePlaza,
} from "./plaza.controller.js";

export const plazaRouter = Router();

plazaRouter.use(requireAuth);

// Operators need the plaza list (and its rates) for the toll simulator; only admins change anything.
plazaRouter.get("/", requireRole("OPERATOR", "ADMIN"), listPlazas);
plazaRouter.post("/", requireRole("ADMIN"), createPlaza);
plazaRouter.patch("/:id", requireRole("ADMIN"), updatePlaza);
plazaRouter.post("/:plazaId/rates", requireRole("ADMIN"), setRate);
plazaRouter.patch("/:plazaId/rates/:rateId", requireRole("ADMIN"), deactivateRate);