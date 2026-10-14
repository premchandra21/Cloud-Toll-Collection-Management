import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/responses/response.js";
import { revenueReportQuerySchema } from "../dashboard/dashboard.schema.js";
import { reportService } from "./report.service.js";

export async function getRevenueReport(req: Request, res: Response) {
  const query = revenueReportQuerySchema.parse(req.query);
  const report = await reportService.revenue(query);
  sendSuccess(res, report, "Revenue report fetched");
}