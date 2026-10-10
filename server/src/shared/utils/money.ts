// Structural type so we never import Prisma's Decimal class directly.
// Prisma returns Decimal objects for NUMERIC columns; we only ever format them.
export interface DecimalLike {
  toFixed(decimalPlaces?: number): string;
  abs(): DecimalLike;
  lte(value: number): boolean;
}

// Money leaves the API as a string with 2 decimals ("80.00"), never a float.
export function money(value: DecimalLike | null | undefined): string {
  return value ? value.toFixed(2) : "0.00";
}