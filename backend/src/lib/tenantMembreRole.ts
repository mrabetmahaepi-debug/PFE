import type { PrismaClient } from "@prisma/client";

/** Rôle global « Membre » pour invitations et comptes invités (par entreprise). */
export async function resolveTenantMembreRoleId(
  prisma: PrismaClient,
  idEntreprise: number
): Promise<number | null> {
  const candidates = ["Membre", "Member", "MEMBRE", "membre", "member"];
  for (const nom of candidates) {
    const r = await prisma.role.findFirst({
      where: { id_entreprise: idEntreprise, nom },
      select: { id_role: true },
    });
    if (r?.id_role) return r.id_role;
  }
  const fuzzy = await prisma.role.findFirst({
    where: {
      id_entreprise: idEntreprise,
      nom: { contains: "Membre" },
    },
    select: { id_role: true },
  });
  return fuzzy?.id_role ?? null;
}
