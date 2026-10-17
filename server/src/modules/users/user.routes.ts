import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { listUsers, setUserCredit, setUserPlazas, updateUser } from "./user.controller.js";

export const userRouter = Router();

userRouter.use(requireAuth, requireRole("ADMIN"));

userRouter.get("/", listUsers);
userRouter.patch("/:id", updateUser);
userRouter.put("/:id/plazas", setUserPlazas);
userRouter.put("/:id/credit", setUserCredit);