import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { prisma } from "./config/database.js";
import { requestId } from "./middleware/request-id.middleware.js";
import { errorHandler, notFound } from "./middleware/error.middleware.js";
import { authRouter } from "./modules/auth/auth.routes.js";

export const app = express();

const allowedOrigins = env.CLIENT_ORIGIN.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(requestId);
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/api/v1/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ success: true, message: "OK", data: { db: "connected" } });
});

app.use("/api/v1/auth", authRouter);

// Must stay last
app.use(notFound);
app.use(errorHandler);