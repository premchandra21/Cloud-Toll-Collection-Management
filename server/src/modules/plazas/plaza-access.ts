import { prisma } from "../../config/database.js";
import type { AuthUser } from "../../shared/types.js";

// Which plazas may this person work with?
//   null     -> every plaza (ADMIN)
//   string[] -> only these plaza ids (OPERATOR; an operator with no assignment gets [])
//   []       -> USER role, which has no staff access at all (defensive default)
//
// Read from the database on every call (not from the JWT), so when an admin changes an
// assignment it applies on the operator's very next request, the same way isActive does.
export type PlazaScope = string[] | null;

export async function getPlazaScope(actor: AuthUser): Promise<PlazaScope> {
  if (actor.role === "ADMIN") return null;
  if (actor.role === "OPERATOR") {
    const rows = await prisma.operatorPlaza.findMany({
      where: { userId: actor.id },
      select: { plazaId: true },
    });
    return rows.map((r) => r.plazaId);
  }
  return [];
}

export function canAccessPlaza(scope: PlazaScope, plazaId: string): boolean {
  return scope === null || scope.includes(plazaId);
}