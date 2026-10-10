import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/responses/response.js";
import { ledgerQuerySchema, topUpSchema } from "./wallet.schema.js";
import { walletService } from "./wallet.service.js";

export async function getWallet(req: Request, res: Response) {
  const wallet = await walletService.getSummary(req.user!.id);
  sendSuccess(res, { wallet }, "Wallet fetched");
}

export async function topUp(req: Request, res: Response) {
  const input = topUpSchema.parse(req.body ?? {});
  const result = await walletService.topUp(req.user!.id, input);
  sendSuccess(res, result, "Wallet topped up", 201);
}

export async function listTransactions(req: Request, res: Response) {
  const query = ledgerQuerySchema.parse(req.query);
  const { items, meta } = await walletService.listLedger(req.user!.id, query);
  sendSuccess(res, { transactions: items }, "Wallet transactions fetched", 200, meta);
}