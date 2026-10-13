import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/responses/response.js";
import { updateUserSchema, userIdParamsSchema, userListQuerySchema } from "./user.schema.js";
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