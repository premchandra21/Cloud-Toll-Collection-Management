import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { getWallet, listTransactions, topUp } from "./wallet.controller.js";

export const walletRouter = Router();

// A wallet belongs to the logged-in USER; the user id always comes from the JWT.
walletRouter.use(requireAuth, requireRole("USER"));

walletRouter.get("/", getWallet);
walletRouter.post("/top-up", topUp);
walletRouter.get("/transactions", listTransactions);