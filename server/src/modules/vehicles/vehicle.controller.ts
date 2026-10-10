import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/responses/response.js";
import {
  createVehicleSchema,
  updateVehicleSchema,
  vehicleIdParamsSchema,
} from "./vehicle.schema.js";
import { vehicleService } from "./vehicle.service.js";

export async function listVehicles(req: Request, res: Response) {
  const vehicles = await vehicleService.list(req.user!);
  sendSuccess(res, { vehicles }, "Vehicles fetched");
}

export async function createVehicle(req: Request, res: Response) {
  const input = createVehicleSchema.parse(req.body ?? {});
  const vehicle = await vehicleService.create(input, req.user!);
  sendSuccess(res, { vehicle }, "Vehicle added", 201);
}

export async function updateVehicle(req: Request, res: Response) {
  const { id } = vehicleIdParamsSchema.parse(req.params);
  const input = updateVehicleSchema.parse(req.body ?? {});
  const vehicle = await vehicleService.update(id, input, req.user!);
  sendSuccess(res, { vehicle }, "Vehicle updated");
}