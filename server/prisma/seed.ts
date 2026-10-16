import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type Role = "USER" | "OPERATOR" | "ADMIN";
type VehicleType = "CAR" | "BUS" | "TRUCK" | "HEAVY_VEHICLE";

const DEMO_USERS: { name: string; email: string; password: string; role: Role }[] = [
  { name: "Admin", email: "admin@toll.test", password: "Admin@123", role: "ADMIN" },
  { name: "Operator One", email: "operator@toll.test", password: "Operator@123", role: "OPERATOR" },
  { name: "Operator Two", email: "operator2@toll.test", password: "Operator@123", role: "OPERATOR" },
  { name: "Asha Driver", email: "asha@toll.test", password: "Driver@123", role: "USER" },
  { name: "Ravi Driver", email: "ravi@toll.test", password: "Driver@123", role: "USER" },
  { name: "Meera Driver", email: "meera@toll.test", password: "Driver@123", role: "USER" },
];

const PLAZAS = [
  { code: "BBS-01", name: "Bhubaneswar North Plaza", location: "NH-16, Bhubaneswar" },
  { code: "CTC-01", name: "Cuttack Plaza", location: "NH-16, Cuttack" },
];

// Rates per vehicle type; the second plaza is slightly cheaper
const RATES: Record<string, Record<VehicleType, string>> = {
  "BBS-01": { CAR: "80.00", BUS: "160.00", TRUCK: "200.00", HEAVY_VEHICLE: "320.00" },
  "CTC-01": { CAR: "60.00", BUS: "120.00", TRUCK: "150.00", HEAVY_VEHICLE: "250.00" },
};

// Which plazas each operator may work at. Operator One only sees Bhubaneswar, Operator Two only Cuttack,
// so the demo can show that one plaza's operator cannot touch the other's tolls. Admins need no entry.
const OPERATOR_PLAZAS: Record<string, string[]> = {
  "operator@toll.test": ["BBS-01"],
  "operator2@toll.test": ["CTC-01"],
};

const VEHICLES: { ownerEmail: string; vehicleNumber: string; vehicleType: VehicleType; rfidTag: string }[] = [
  { ownerEmail: "asha@toll.test", vehicleNumber: "OD02AB1234", vehicleType: "CAR", rfidTag: "RFID-0001" },
  { ownerEmail: "asha@toll.test", vehicleNumber: "OD02CD5678", vehicleType: "TRUCK", rfidTag: "RFID-0002" },
  { ownerEmail: "ravi@toll.test", vehicleNumber: "OD05EF9012", vehicleType: "BUS", rfidTag: "RFID-0003" },
  { ownerEmail: "meera@toll.test", vehicleNumber: "OD07GH3456", vehicleType: "CAR", rfidTag: "RFID-0004" },
];

const OPENING_BALANCE: Record<string, string> = {
  "asha@toll.test": "500.00",
  "ravi@toll.test": "50.00",
  "meera@toll.test": "30.00",
};

// Pay-later (toll on credit) limits. Only Meera has the facility, so the existing demos and evidence
// scripts (Asha, Ravi) behave exactly as before. A wallet with 0 / 0 has no pay-later.
const CREDIT_LIMITS: Record<string, { creditLimit: string; monthlyCreditLimit: string }> = {
  "meera@toll.test": { creditLimit: "300.00", monthlyCreditLimit: "600.00" },
};

async function main() {
  // Users
  const users: Record<string, { id: string; role: Role }> = {};
  for (const u of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, isActive: true },
      create: { name: u.name, email: u.email, passwordHash, role: u.role },
    });
    users[u.email] = { id: row.id, role: row.role as Role };
  }

  // Plazas
  const plazaIds: Record<string, string> = {};
  for (const p of PLAZAS) {
    const row = await prisma.tollPlaza.upsert({
      where: { code: p.code },
      update: { name: p.name, location: p.location },
      create: p,
    });
    plazaIds[p.code] = row.id;
  }

  // Rates (create only if no active rate exists for plaza + vehicleType)
  for (const [code, byType] of Object.entries(RATES)) {
    for (const [vehicleType, amount] of Object.entries(byType)) {
      const existing = await prisma.tollRate.findFirst({
        where: { plazaId: plazaIds[code], vehicleType: vehicleType as VehicleType, isActive: true },
      });
      if (!existing) {
        await prisma.tollRate.create({
          data: { plazaId: plazaIds[code], vehicleType: vehicleType as VehicleType, amount, isActive: true },
        });
      }
    }
  }

  // Operator -> plaza assignments (only adds missing rows, so changes made by an admin are kept)
  for (const [email, codes] of Object.entries(OPERATOR_PLAZAS)) {
    await prisma.operatorPlaza.createMany({
      data: codes.map((code) => ({ userId: users[email].id, plazaId: plazaIds[code] })),
      skipDuplicates: true,
    });
  }

  // Vehicles
  for (const v of VEHICLES) {
    await prisma.vehicle.upsert({
      where: { vehicleNumber: v.vehicleNumber },
      update: {},
      create: {
        userId: users[v.ownerEmail].id,
        vehicleNumber: v.vehicleNumber,
        vehicleType: v.vehicleType,
        rfidTag: v.rfidTag,
      },
    });
  }

  // Wallets: one per USER. The opening balance is written as a TOP_UP ledger
  // row so the ledger invariant (sum of ledger == balance) holds from day one.
  for (const [email, balance] of Object.entries(OPENING_BALANCE)) {
    const userId = users[email].id;
    const existing = await prisma.wallet.findUnique({ where: { userId } });
    if (existing) continue;
    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.create({
        data: { userId, balance, ...(CREDIT_LIMITS[email] ?? {}) },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "TOP_UP",
          amount: balance,
          balanceAfter: balance,
          referenceType: "SEED",
          description: "Opening balance (seed)",
        },
      });
    });
  }

  console.log("\nSeed complete. Demo credentials:");
  for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(8)} ${u.email}  /  ${u.password}`);
  console.log("\nDemo RFIDs: RFID-0001 (Asha, CAR), RFID-0002 (Asha, TRUCK), RFID-0003 (Ravi, BUS, low balance)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());