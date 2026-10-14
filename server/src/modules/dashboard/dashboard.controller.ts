import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/responses/response.js";
import { dashboardQuerySchema } from "./dashboard.schema.js";
import { dashboardService } from "./dashboard.service.js";

export async function getSummary(req: Request, res: Response) {
  const query = dashboardQuerySchema.parse(req.query);
  const summary = await dashboardService.summary(query);
  sendSuccess(res, summary, "Dashboard summary fetched");
}