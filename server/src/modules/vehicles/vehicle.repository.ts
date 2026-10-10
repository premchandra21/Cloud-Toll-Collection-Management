import { prisma } from "../../config/database.js";
import type { VEHICLE_TYPES } from "./vehicle.schema.js";

const vehicleSelect = {
  id: true,
  userId: true,
  vehicleNumber: true,
  vehicleType: true,
  rfidTag: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

type VehicleType = (typeof VEHICLE_TYPES)[number];

export const vehicleRepository = {
  findByUser(userId: string) {
    return prisma.vehicle.findMany({
      where: { userId },
      select: vehicleSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  findAll() {
    return prisma.vehicle.findMany({ select: vehicleSelect, orderBy: { createdAt: "desc" } });
  },

  findById(id: string) {
    return prisma.vehicle.findUnique({ where: { id }, select: vehicleSelect });
  },

  // Returns a vehicle that already uses the given number or RFID (other than excludeId).
  findClash(fields: { vehicleNumber?: string; rfidTag?: string }, excludeId?: string) {
    const or = [
      ...(fields.vehicleNumber ? [{ vehicleNumber: fields.vehicleNumber }] : []),
      ...(fields.rfidTag ? [{ rfidTag: fields.rfidTag }] : []),
    ];
    if (or.length === 0) return Promise.resolve(null);
    return prisma.vehicle.findFirst({
      where: { OR: or, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { vehicleNumber: true, rfidTag: true },
    });
  },

  findOwner(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true },
    });
  },

  create(data: { userId: string; vehicleNumber: string; vehicleType: VehicleType; rfidTag: string }) {
    return prisma.vehicle.create({ data, select: vehicleSelect });
  },

  update(
    id: string,
    data: { vehicleNumber?: string; vehicleType?: VehicleType; rfidTag?: string; isActive?: boolean },
  ) {
    return prisma.vehicle.update({ where: { id }, data, select: vehicleSelect });
  },
};