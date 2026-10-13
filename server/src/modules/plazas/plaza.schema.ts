import { z } from "zod";
import { VEHICLE_TYPES } from "../vehicles/vehicle.schema.js";

export const MAX_RATE = 100000;

// Normalised so "bbs-01" and "BBS-01" are the same plaza code.
const plazaCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9-]{2,20}$/, "Code must be 2-20 letters, digits or hyphens"));

const plazaNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be at most 100 characters");

const plazaLocationSchema = z
  .string()
  .trim()
  .min(2, "Location must be at least 2 characters")
  .max(150, "Location must be at most 150 characters");

// "80", 80, "80.5" -> "80.00". Done with string handling only, so no float ever
// reaches the database and the result can be compared with money() output.
function normaliseAmount(v: string): string {
  const [whole = "0", frac = ""] = v.split(".");
  return `${whole.replace(/^0+(?=\d)/, "")}.${frac.padEnd(2, "0")}`;
}

export const rateAmountSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .pipe(z.string().regex(/^\d{1,6}(\.\d{1,2})?$/, "Enter a valid amount with at most 2 decimal places"))
  // second pipe only runs when the format is valid, so the user sees one message, not two
  .pipe(
    z.string().refine((v) => Number(v) > 0 && Number(v) <= MAX_RATE, {
      message: `Rate must be greater than 0 and at most ${MAX_RATE}`,
    }),
  )
  .transform(normaliseAmount);

export const createPlazaSchema = z.object({
  name: plazaNameSchema,
  code: plazaCodeSchema,
  location: plazaLocationSchema,
});

export const updatePlazaSchema = z
  .object({
    name: plazaNameSchema.optional(),
    code: plazaCodeSchema.optional(),
    location: plazaLocationSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "Provide at least one field to update",
  });

// Sets the ACTIVE rate for one vehicle type at one plaza.
export const setRateSchema = z.object({
  vehicleType: z.enum(VEHICLE_TYPES),
  amount: rateAmountSchema,
});

// Rates are never edited in place or deleted (toll transactions point at them);
// the only change allowed on an existing rate is switching it off.
export const deactivateRateSchema = z.object({
  isActive: z.literal(false, { error: "Only isActive: false is allowed" }),
});

export const plazaIdParamsSchema = z.object({ id: z.uuid() });
export const plazaRateParamsSchema = z.object({ plazaId: z.uuid() });
export const rateIdParamsSchema = z.object({ plazaId: z.uuid(), rateId: z.uuid() });

export type CreatePlazaInput = z.infer<typeof createPlazaSchema>;
export type UpdatePlazaInput = z.infer<typeof updatePlazaSchema>;
export type SetRateInput = z.infer<typeof setRateSchema>;