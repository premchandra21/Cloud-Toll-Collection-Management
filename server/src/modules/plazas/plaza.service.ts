import { AppError } from "../../shared/errors/AppError.js";
import { money } from "../../shared/utils/money.js";
import { plazaRepository } from "./plaza.repository.js";
import type { CreatePlazaInput, SetRateInput, UpdatePlazaInput } from "./plaza.schema.js";

type PlazaRow = NonNullable<Awaited<ReturnType<typeof plazaRepository.findById>>>;
type RateRow = NonNullable<Awaited<ReturnType<typeof plazaRepository.findRateById>>>;

function toRateDto(r: RateRow) {
  return {
    id: r.id,
    plazaId: r.plazaId,
    vehicleType: r.vehicleType,
    amount: money(r.amount),
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function toPlazaDto(p: PlazaRow) {
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    location: p.location,
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    rates: p.rates.map(toRateDto), // active rates only
  };
}

function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

function codeTaken() {
  return new AppError(409, "CONFLICT", "A plaza with this code already exists", [
    { field: "code", message: "Already in use" },
  ]);
}

async function getPlaza(id: string) {
  const plaza = await plazaRepository.findById(id);
  if (!plaza) throw new AppError(404, "RESOURCE_NOT_FOUND", "Plaza not found");
  return plaza;
}

export const plazaService = {
  async list() {
    const rows = await plazaRepository.findAll();
    return rows.map(toPlazaDto);
  },

  async create(input: CreatePlazaInput) {
    if (await plazaRepository.findByCode(input.code)) throw codeTaken();

    try {
      return toPlazaDto(await plazaRepository.create(input));
    } catch (err) {
      if (isUniqueViolation(err)) throw codeTaken();
      throw err;
    }
  },

  async update(id: string, input: UpdatePlazaInput) {
    const existing = await getPlaza(id);

    if (input.code && input.code !== existing.code) {
      if (await plazaRepository.findByCode(input.code, id)) throw codeTaken();
    }

    try {
      return toPlazaDto(await plazaRepository.update(id, input));
    } catch (err) {
      if (isUniqueViolation(err)) throw codeTaken();
      throw err;
    }
  },

  // "Create/update toll rate": the new amount becomes the ACTIVE rate and the old one is
  // switched off (kept for history; past toll transactions still point at it).
  async setRate(plazaId: string, input: SetRateInput) {
    const plaza = await getPlaza(plazaId);

    const current = plaza.rates.find((r) => r.vehicleType === input.vehicleType);
    if (current && money(current.amount) === input.amount) {
      return { rate: toRateDto(current), changed: false };
    }

    try {
      const rate = await plazaRepository.setActiveRate(plazaId, input.vehicleType, input.amount);
      return { rate: toRateDto(rate), changed: true };
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError(
          409,
          "CONFLICT",
          "This rate was just changed by someone else. Refresh and try again.",
        );
      }
      throw err;
    }
  },

  async deactivateRate(plazaId: string, rateId: string) {
    const rate = await plazaRepository.findRateById(rateId);
    // A rate that belongs to another plaza is reported as not found.
    if (!rate || rate.plazaId !== plazaId) {
      throw new AppError(404, "RESOURCE_NOT_FOUND", "Rate not found");
    }
    if (!rate.isActive) return toRateDto(rate);
    return toRateDto(await plazaRepository.deactivateRate(rateId));
  },
};