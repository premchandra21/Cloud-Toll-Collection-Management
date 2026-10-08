import type { RequestHandler } from "express";
import { AppError } from "../shared/errors/AppError.js";
import type { Role } from "../shared/types.js";

// Use after requireAuth: router.get("/x", requireAuth, requireRole("ADMIN"), handler)
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to perform this action");
    }
    next();
  };
}