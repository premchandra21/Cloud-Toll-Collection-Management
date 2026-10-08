import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/responses/response.js";
import { authRepository } from "./auth.repository.js";
import { loginSchema, registerSchema } from "./auth.schema.js";
import { authService } from "./auth.service.js";

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body ?? {});
  const result = await authService.register(input);
  sendSuccess(res, result, "Registered successfully", 201);
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body ?? {});
  const result = await authService.login(input);
  sendSuccess(res, result, "Login successful");
}

export async function me(req: Request, res: Response) {
  // requireAuth has already validated the token and loaded the active user
  const user = await authRepository.findPublicById(req.user!.id);
  sendSuccess(res, { user }, "Current user");
}