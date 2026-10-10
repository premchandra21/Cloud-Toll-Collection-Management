import { z } from "zod";

export const VEHICLE_TYPES = ["CAR", "BUS", "TRUCK", "HEAVY_VEHICLE"] as const;

// Normalised before validation so "od 02-ab 1234" and "OD02AB1234" are the same vehicle.
export const vehicleNumberSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase().replace(/[\s-]+/g, ""))
  .pipe(z.string().regex(/^[A-Z0-9]{4,15}$/, "Vehicle number must be 4-15 letters or digits"));

// Reuse this exact schema when the toll-processing slice looks vehicles up by RFID.
export const rfidTagSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9-]{3,64}$/, "RFID tag must be 3-64 letters, digits or hyphens"));

export const createVehicleSchema = z.object({
  vehicleNumber: vehicleNumberSchema,
  vehicleType: z.enum(VEHICLE_TYPES),
  rfidTag: rfidTagSchema,
  // Only used when an ADMIN adds a vehicle for a driver. Ignored for USER (taken from the JWT).
  userId: z.uuid().optional(),
});

export const updateVehicleSchema = z
  .object({
    vehicleNumber: vehicleNumberSchema.optional(),
    vehicleType: z.enum(VEHICLE_TYPES).optional(),
    rfidTag: rfidTagSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "Provide at least one field to update",
  });

export const vehicleIdParamsSchema = z.object({ id: z.uuid() });

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;