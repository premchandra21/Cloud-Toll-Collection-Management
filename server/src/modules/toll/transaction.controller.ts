import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/responses/response.js";
import {
  transactionFiltersSchema,
  transactionIdParamsSchema,
  transactionListQuerySchema,
} from "./transaction.schema.js";
import { transactionService } from "./transaction.service.js";

export async function listTransactions(req: Request, res: Response) {
  const query = transactionListQuerySchema.parse(req.query);
  const { items, meta } = await transactionService.list(query, req.user!);
  sendSuccess(res, { transactions: items }, "Transactions fetched", 200, meta);
}

export async function getTransaction(req: Request, res: Response) {
  const { id } = transactionIdParamsSchema.parse(req.params);
  const transaction = await transactionService.getById(id, req.user!);
  sendSuccess(res, { transaction }, "Transaction fetched");
}

// Not wrapped in the JSON envelope: the body is the CSV file itself.
export async function exportTransactions(req: Request, res: Response) {
  const filters = transactionFiltersSchema.parse(req.query);
  const csv = await transactionService.exportCsv(filters, req.user!);

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="toll-transactions-${stamp}.csv"`);
  res.setHeader("Cache-Control", "no-store");
  // BOM so Excel opens the file as UTF-8 (driver names may contain non-ASCII characters)
  res.send(`\uFEFF${csv}`);
}