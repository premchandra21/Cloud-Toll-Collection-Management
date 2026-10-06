import express from "express";
import cors from "cors";
import helmet from "helmet";
import { prisma } from "./config/database.js";

export const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN }));
app.use(express.json());

app.get("/api/v1/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ success: true, message: "OK", data: { db: "connected" } });
});