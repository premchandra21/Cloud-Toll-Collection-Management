import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/responses/response.js";
import { revenueReportQuerySchema } from "../dashboard/dashboard.schema.js";
import { reportService } from "./report.service.js";

export async function getRevenueReport(req: Request, res: Response) {
  const query = revenueReportQuerySchema.parse(req.query);
  const report = await reportService.revenue(query, req.user!);
  sendSuccess(res, report, "Revenue report fetched");
}

export async function getReconciliation(_req: Request, res: Response) {
  const report = await reportService.reconciliation();
  sendSuccess(res, report, report.ok ? "Ledger reconciles" : "Ledger mismatch found");
}