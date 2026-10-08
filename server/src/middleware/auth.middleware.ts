import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { authRepository } from "../modules/auth/auth.repository.js";
import { AppError } from "../shared/errors/AppError.js";

// Step 1 of protection: valid JWT + the user still exists and is active.
// Role checks are done afterwards by requireRole().
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHORIZED", "Missing or invalid Authorization header");
  }

  const token = header.slice(7).trim();
  let userId: string;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload === "string" || !payload.sub) throw new Error("Bad payload");
    userId = payload.sub;
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired token");
  }

  const user = await authRepository.findPublicById(userId);
  if (!user || !user.isActive) {
    throw new AppError(401, "UNAUTHORIZED", "Account not found or disabled");
  }

  req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  next();
};