import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/responses/response.js";
import { processTollSchema } from "./toll.schema.js";
import { tollService } from "./toll.service.js";

// 201 = a new toll transaction was recorded (SUCCESS or FAILED, see data.status).
// 200 = duplicate event: the existing transaction is returned and nothing was charged again.
export async function processToll(req: Request, res: Response) {
  const input = processTollSchema.parse(req.body ?? {});
  const result = await tollService.process(input);

  if (result.idempotentReplay) {
    sendSuccess(res, result, "Duplicate event: existing transaction returned", 200);
    return;
  }
  const message =
    result.status === "SUCCESS"
      ? "Toll processed successfully"
      : "Toll failed: insufficient wallet balance";
  sendSuccess(res, result, message, 201);
}