import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/responses/response.js";
import {
  createPlazaSchema,
  deactivateRateSchema,
  plazaIdParamsSchema,
  plazaRateParamsSchema,
  rateIdParamsSchema,
  setRateSchema,
  updatePlazaSchema,
} from "./plaza.schema.js";
import { plazaService } from "./plaza.service.js";

export async function listPlazas(_req: Request, res: Response) {
  const plazas = await plazaService.list();
  sendSuccess(res, { plazas }, "Plazas fetched");
}

export async function createPlaza(req: Request, res: Response) {
  const input = createPlazaSchema.parse(req.body ?? {});
  const plaza = await plazaService.create(input);
  sendSuccess(res, { plaza }, "Plaza created", 201);
}

export async function updatePlaza(req: Request, res: Response) {
  const { id } = plazaIdParamsSchema.parse(req.params);
  const input = updatePlazaSchema.parse(req.body ?? {});
  const plaza = await plazaService.update(id, input);
  sendSuccess(res, { plaza }, "Plaza updated");
}

export async function setRate(req: Request, res: Response) {
  const { plazaId } = plazaRateParamsSchema.parse(req.params);
  const input = setRateSchema.parse(req.body ?? {});
  const { rate, changed } = await plazaService.setRate(plazaId, input);
  sendSuccess(res, { rate, changed }, changed ? "Rate saved" : "Rate unchanged", changed ? 201 : 200);
}

export async function deactivateRate(req: Request, res: Response) {
  const { plazaId, rateId } = rateIdParamsSchema.parse(req.params);
  deactivateRateSchema.parse(req.body ?? {});
  const rate = await plazaService.deactivateRate(plazaId, rateId);
  sendSuccess(res, { rate }, "Rate removed");
}