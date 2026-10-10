import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { createVehicle, listVehicles, updateVehicle } from "./vehicle.controller.js";

export const vehicleRouter = Router();

// JWT first, then role. Ownership is enforced inside the service.
vehicleRouter.use(requireAuth, requireRole("USER", "ADMIN"));

vehicleRouter.get("/", listVehicles);
vehicleRouter.post("/", createVehicle);
vehicleRouter.patch("/:id", updateVehicle);