import express from "express";
import cors from "cors";
import helmet from "helmet";
import { prisma } from "./config/database.js";

export const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/api/v1/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ success: true, message: "OK", data: { db: "connected" } });
});