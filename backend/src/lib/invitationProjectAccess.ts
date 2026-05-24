import prisma from "../prisma/prismaClient";
import {
  ensureProjectAffectation,
  upsertAccessGrant,
  upsertMembreProjetAccess,
} from "./userAccessGrants";
import { resolveProjectPosteLabel, isChefDeProjetPoste } from "./projectRoleLabels";

export async function validateEnterpriseProjectIds(
  enterpriseId: number,
  projectIds: number[]
): Promise<number[]> {
  const unique = [
    ...new Set(
      projectIds.filter((id) => Number.isFinite(id) && Number.isInteger(id) && id > 0)
    ),
  ];
  if (unique.length === 0) return [];

  const rows = await prisma.projet.findMany({
    where: { id_projet: { in: unique }, id_entreprise: enterpriseId },
    select: { id_projet: true },
  });
  const valid = new Set(rows.map((r) => r.id_projet));
  return unique.filter((id) => valid.has(id));
}

/**
 * Assigns project membership + PROJECT grants for a pending or active invitee.
 * For INVITATION_PENDING users, replaces project memberships with the selected set.
 */
export async function syncInvitationProjectAccess(input: {
  userId: number;
  enterpriseId: number;
  projectIds: number[];
  poste: string;
  grantedById: number;
  invitationPending?: boolean;
}): Promise<{ projectIds: number[] }> {
  const roleLabel = resolveProjectPosteLabel(input.poste);
  const validIds = await validateEnterpriseProjectIds(
    input.enterpriseId,
    input.projectIds
  );
  if (validIds.length === 0) {
    throw new Error("Aucun projet valide sélectionné pour cette entreprise.");
  }

  if (input.invitationPending) {
    const enterpriseProjects = await prisma.projet.findMany({
      where: { id_entreprise: input.enterpriseId },
      select: { id_projet: true },
    });
    const enterpriseProjectIds = enterpriseProjects.map((p) => p.id_projet);
    await prisma.membre_projet.deleteMany({
      where: {
        id_utilisateur: input.userId,
        id_projet: { in: enterpriseProjectIds, notIn: validIds.length ? validIds : [-1] },
      },
    });
    await prisma.utilisateur_access_grant.deleteMany({
      where: {
        id_utilisateur: input.userId,
        id_entreprise: input.enterpriseId,
        resource_type: "PROJECT",
        resource_id: {
          in: enterpriseProjectIds,
          notIn: validIds.length ? validIds : [-1],
        },
      },
    });
  }

  const affectationRole = isChefDeProjetPoste(roleLabel) ? "chef" : "membre";

  for (const projectId of validIds) {
    await prisma.$transaction(async (tx) => {
      await upsertMembreProjetAccess(projectId, input.userId, roleLabel, tx);
      await ensureProjectAffectation(
        projectId,
        input.userId,
        affectationRole,
        tx
      );
      await upsertAccessGrant({
        userId: input.userId,
        enterpriseId: input.enterpriseId,
        resourceType: "PROJECT",
        resourceId: projectId,
        effect: "GRANT",
        roleProjet: roleLabel,
        grantedById: input.grantedById,
        tx,
      });
    });
  }

  return { projectIds: validIds };
}

export async function listInvitationProjectsForUser(
  userId: number
): Promise<Array<{ id_projet: number; nom: string }>> {
  const rows = await prisma.membre_projet.findMany({
    where: { id_utilisateur: userId },
    include: { projet: { select: { id_projet: true, nom_p: true } } },
  });
  return rows
    .map((r) => r.projet)
    .filter((p): p is { id_projet: number; nom_p: string | null } => !!p)
    .map((p) => ({
      id_projet: p.id_projet,
      nom: (p.nom_p && String(p.nom_p).trim()) || `Projet #${p.id_projet}`,
    }));
}
