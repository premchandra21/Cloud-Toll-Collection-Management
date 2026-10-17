import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/responses/response.js";
import { creditService } from "./credit.service.js";

export async function runReminders(_req: Request, res: Response) {
  const result = await creditService.sendReminders();
  sendSuccess(res, result, "Pay-later reminders sent");
}