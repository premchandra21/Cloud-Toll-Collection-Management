import { prisma } from "../../config/database.js";
import type { VEHICLE_TYPES } from "../vehicles/vehicle.schema.js";

type VehicleType = (typeof VEHICLE_TYPES)[number];

const rateSelect = {
  id: true,
  plazaId: true,
  vehicleType: true,
  amount: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

// A plaza always comes back with its ACTIVE rates only (at most one per vehicle type).
// Postgres sorts enums in declaration order: CAR, BUS, TRUCK, HEAVY_VEHICLE.
const plazaSelect = {
  id: true,
  name: true,
  code: true,
  location: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  rates: {
    where: { isActive: true },
    orderBy: { vehicleType: "asc" },
    select: rateSelect,
  },
} as const;

export const plazaRepository = {
  // onlyIds = null means every plaza; an array limits the result to those ids.
  findAll(onlyIds: string[] | null = null) {
    return prisma.tollPlaza.findMany({
      where: onlyIds ? { id: { in: onlyIds } } : {},
      select: plazaSelect,
      orderBy: { createdAt: "asc" },
    });
  },

  findById(id: string) {
    return prisma.tollPlaza.findUnique({ where: { id }, select: plazaSelect });
  },

  findByCode(code: string, excludeId?: string) {
    return prisma.tollPlaza.findFirst({
      where: { code, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
  },

  create(data: { name: string; code: string; location: string }) {
    return prisma.tollPlaza.create({ data, select: plazaSelect });
  },

  update(
    id: string,
    data: { name?: string; code?: string; location?: string; isActive?: boolean },
  ) {
    return prisma.tollPlaza.update({ where: { id }, data, select: plazaSelect });
  },

  findRateById(id: string) {
    return prisma.tollRate.findUnique({ where: { id }, select: rateSelect });
  },

  // Replace the active rate: switch the old one off and insert the new one in ONE
  // transaction, so the plaza never has zero or two active rates for a vehicle type.
  // The partial unique index is the final guard if two admins save at the same moment.
  setActiveRate(plazaId: string, vehicleType: VehicleType, amount: string) {
    return prisma.$transaction(async (tx) => {
      await tx.tollRate.updateMany({
        where: { plazaId, vehicleType, isActive: true },
        data: { isActive: false },
      });
      return tx.tollRate.create({
        data: { plazaId, vehicleType, amount, isActive: true },
        select: rateSelect,
      });
    });
  },

  deactivateRate(id: string) {
    return prisma.tollRate.update({
      where: { id },
      data: { isActive: false },
      select: rateSelect,
    });
  },
};