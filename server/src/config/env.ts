import "dotenv/config";
import { z } from "zod";

function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(8, "JWT_SECRET must be at least 8 characters"),
  JWT_EXPIRES_IN: z.string().default("1d"),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  LOW_BALANCE_THRESHOLD: z.coerce.number().default(100),
  // Pay-later: days a driver has to settle a toll that was passed on credit.
  CREDIT_DUE_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  // Time zone that decides where a "calendar month" starts for the monthly credit limit.
  CREDIT_TIMEZONE: z
    .string()
    .default("Asia/Kolkata")
    .refine(isValidTimeZone, "CREDIT_TIMEZONE must be a valid IANA time zone, e.g. Asia/Kolkata"),
  // Pay-later: the reminder job warns a driver when dues fall due within this many days.
  CREDIT_REMIND_DAYS: z.coerce.number().int().min(1).max(30).default(2),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:\n" + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;