import { AppError } from "../../shared/errors/AppError.js";
import type { AuthUser } from "../../shared/types.js";
import { vehicleRepository } from "./vehicle.repository.js";
import type { CreateVehicleInput, UpdateVehicleInput } from "./vehicle.schema.js";

type VehicleRow = NonNullable<Awaited<ReturnType<typeof vehicleRepository.findById>>>;

function toDto(v: VehicleRow) {
  return {
    id: v.id,
    userId: v.userId,
    owner: { id: v.user.id, name: v.user.name, email: v.user.email },
    vehicleNumber: v.vehicleNumber,
    vehicleType: v.vehicleType,
    rfidTag: v.rfidTag,
    isActive: v.isActive,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

// Pre-check gives a field-specific message; the P2002 catch below covers races.
async function assertUnique(
  fields: { vehicleNumber?: string; rfidTag?: string },
  excludeId?: string,
) {
  const clash = await vehicleRepository.findClash(fields, excludeId);
  if (!clash) return;

  if (fields.vehicleNumber && clash.vehicleNumber === fields.vehicleNumber) {
    throw new AppError(409, "CONFLICT", "A vehicle with this number is already registered", [
      { field: "vehicleNumber", message: "Already registered" },
    ]);
  }
  throw new AppError(409, "CONFLICT", "This RFID tag is already assigned to another vehicle", [
    { field: "rfidTag", message: "Already assigned" },
  ]);
}

// Ownership rule: ADMIN can touch any vehicle, everyone else only their own.
// A vehicle owned by someone else is reported as 404 so its existence is not leaked.
async function getAccessible(id: string, actor: AuthUser) {
  const vehicle = await vehicleRepository.findById(id);
  if (!vehicle || (actor.role !== "ADMIN" && vehicle.userId !== actor.id)) {
    throw new AppError(404, "RESOURCE_NOT_FOUND", "Vehicle not found");
  }
  return vehicle;
}

export const vehicleService = {
  async list(actor: AuthUser) {
    const rows =
      actor.role === "ADMIN"
        ? await vehicleRepository.findAll()
        : await vehicleRepository.findByUser(actor.id);
    return rows.map(toDto);
  },

  async create(input: CreateVehicleInput, actor: AuthUser) {
    let ownerId = actor.id;

    if (actor.role === "ADMIN") {
      if (!input.userId) {
        throw new AppError(400, "VALIDATION_ERROR", "userId is required when an admin adds a vehicle", [
          { field: "userId", message: "Required" },
        ]);
      }
      const owner = await vehicleRepository.findOwner(input.userId);
      if (!owner || !owner.isActive) {
        throw new AppError(404, "USER_NOT_FOUND", "Driver account not found");
      }
      if (owner.role !== "USER") {
        throw new AppError(409, "CONFLICT", "Vehicles can only be assigned to driver (USER) accounts");
      }
      ownerId = owner.id;
    }

    await assertUnique({ vehicleNumber: input.vehicleNumber, rfidTag: input.rfidTag });

    try {
      const vehicle = await vehicleRepository.create({
        userId: ownerId,
        vehicleNumber: input.vehicleNumber,
        vehicleType: input.vehicleType,
        rfidTag: input.rfidTag,
      });
      return toDto(vehicle);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError(409, "CONFLICT", "Vehicle number or RFID tag is already in use");
      }
      throw err;
    }
  },

  async update(id: string, input: UpdateVehicleInput, actor: AuthUser) {
    const existing = await getAccessible(id, actor);

    await assertUnique(
      {
        vehicleNumber:
          input.vehicleNumber && input.vehicleNumber !== existing.vehicleNumber
            ? input.vehicleNumber
            : undefined,
        rfidTag: input.rfidTag && input.rfidTag !== existing.rfidTag ? input.rfidTag : undefined,
      },
      id,
    );

    try {
      const vehicle = await vehicleRepository.update(id, input);
      return toDto(vehicle);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError(409, "CONFLICT", "Vehicle number or RFID tag is already in use");
      }
      throw err;
    }
  },
};