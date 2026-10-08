import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { Role } from "../../shared/types.js";
import { authRepository } from "./auth.repository.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}

function toPublicUser(u: PublicUser): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
  };
}

function signToken(user: { id: string; role: Role }) {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await authRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError(409, "CONFLICT", "An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    try {
      const user = await authRepository.createUser({
        name: input.name,
        email: input.email,
        passwordHash,
      });
      return { user: toPublicUser(user), token: signToken(user) };
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError(409, "CONFLICT", "An account with this email already exists");
      }
      throw err;
    }
  },

  async login(input: LoginInput) {
    const user = await authRepository.findByEmail(input.email);
    const passwordOk = user ? await bcrypt.compare(input.password, user.passwordHash) : false;

    if (!user || !passwordOk) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid email or password");
    }
    if (!user.isActive) {
      throw new AppError(403, "FORBIDDEN", "This account is disabled");
    }

    return { user: toPublicUser(user), token: signToken(user) };
  },
};