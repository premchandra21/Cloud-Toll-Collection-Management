import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/responses/response.js";
import {
  setUserCreditSchema,
  setUserPlazasSchema,
  updateUserSchema,
  userIdParamsSchema,
  userListQuerySchema,
} from "./user.schema.js";
import { userService } from "./user.service.js";

export async function listUsers(req: Request, res: Response) {
  const query = userListQuerySchema.parse(req.query);
  const { items, meta } = await userService.list(query);
  sendSuccess(res, { users: items }, "Users fetched", 200, meta);
}

export async function updateUser(req: Request, res: Response) {
  const { id } = userIdParamsSchema.parse(req.params);
  const input = updateUserSchema.parse(req.body ?? {});
  const user = await userService.update(id, input, req.user!);
  sendSuccess(res, { user }, "User updated");
}

export async function setUserPlazas(req: Request, res: Response) {
  const { id } = userIdParamsSchema.parse(req.params);
  const input = setUserPlazasSchema.parse(req.body ?? {});
  const user = await userService.setPlazas(id, input, req.user!);
  sendSuccess(res, { user }, "Operator plazas updated");
}

export async function setUserCredit(req: Request, res: Response) {
  const { id } = userIdParamsSchema.parse(req.params);
  const input = setUserCreditSchema.parse(req.body ?? {});
  const user = await userService.setCredit(id, input, req.user!);
  sendSuccess(res, { user }, "Pay-later limits updated");
}