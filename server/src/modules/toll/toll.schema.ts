import { z } from "zod";
import { rfidTagSchema } from "../vehicles/vehicle.schema.js";

// rfidTagSchema is reused from the vehicles module so a lookup is normalised
// (trimmed + uppercase) exactly the way the tag was normalised when it was stored.
export const processTollSchema = z.object({
  rfidTag: rfidTagSchema,
  plazaId: z.uuid(),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "idempotencyKey must be at least 8 characters")
    .max(128, "idempotencyKey must be at most 128 characters"),
});

export type ProcessTollInput = z.infer<typeof processTollSchema>;