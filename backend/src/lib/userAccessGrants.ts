import type { Prisma } from "@prisma/client";
import prisma from "../prisma/prismaClient";
import { isMissingAccessGrantsTable } from "./accessGrantsTable";

export type AccessResourceType =
  | "PROJECT"
  | "SPRINT"
  | "LIST"
  | "TASK"
  | "FEATURE"
  | "PERM";

export type AccessEffect = "GRANT" | "DENY";

export async function upsertMembreProjetAccess(
  projetId: number,
  userId: number,
  roleLabel: string | null,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  const existing = await db.membre_projet.findFirst({
    where: { id_projet: projetId, id_utilisateur: userId },
  });
  if (existing) {
    await db.membre_projet.update({
      where: { id_membre_projet: existing.id_membre_projet },
      data: { role_projet: roleLabel },
    });
    return;
  }
  await db.membre_projet.create({
    data: {
      id_projet: projetId,
      id_utilisateur: userId,
      role_projet: roleLabel,
    },
  });
}

export async function ensureProjectAffectation(
  projetId: number,
  userId: number,
  role: "chef" | "membre",
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  const existing = await db.affectation.findFirst({
    where: { id_projet: projetId, id_utilisateur: userId, id_tache: null },
  });
  if (!existing) {
    await db.affectation.create({
      data: {
        id_projet: projetId,
        id_utilisateur: userId,
        role_affectation: role,
      },
    });
    return;
  }
  if (role === "chef") {
    await db.affectation.update({
      where: { id_affectation: existing.id_affectation },
      data: { role_affectation: "chef" },
    });
  } else if (existing.role_affectation !== "chef") {
    await db.affectation.update({
      where: { id_affectation: existing.id_affectation },
      data: { role_affectation: "membre" },
    });
  }
}

export async function removeMembreProjetAccess(
  projetId: number,
  userId: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  await db.membre_projet.deleteMany({
    where: { id_projet: projetId, id_utilisateur: userId },
  });
  await db.affectation.deleteMany({
    where: { id_projet: projetId, id_utilisateur: userId, id_tache: null },
  });
}

export async function getDeniedProjectIds(userId: number): Promise<Set<number>> {
  try {
    const rows = await prisma.utilisateur_access_grant.findMany({
      where: {
        id_utilisateur: userId,
        resource_type: "PROJECT",
        effect: "DENY",
        resource_id: { not: null },
      },
      select: { resource_id: true },
    });
    return new Set(
      rows
        .map((r) => r.resource_id)
        .filter((id): id is number => id != null && Number.isFinite(id))
    );
  } catch (err) {
    if (isMissingAccessGrantsTable(err)) return new Set();
    throw err;
  }
}

export async function isProjectAccessDenied(
  userId: number,
  projectId: number
): Promise<boolean> {
  if (!Number.isFinite(userId) || userId < 1) return false;
  if (!Number.isFinite(projectId) || projectId < 1) return false;
  try {
    const row = await prisma.utilisateur_access_grant.findFirst({
      where: {
        id_utilisateur: userId,
        resource_type: "PROJECT",
        resource_id: projectId,
        effect: "DENY",
      },
      select: { id_grant: true },
    });
    return row != null;
  } catch (err) {
    if (isMissingAccessGrantsTable(err)) return false;
    throw err;
  }
}

export async function upsertAccessGrant(params: {
  userId: number;
  enterpriseId: number;
  resourceType: AccessResourceType;
  resourceId?: number | null;
  featureKey?: string | null;
  effect: AccessEffect;
  roleProjet?: string | null;
  grantedById?: number | null;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const db = params.tx ?? prisma;
  const existing = await db.utilisateur_access_grant.findFirst({
    where: {
      id_utilisateur: params.userId,
      resource_type: params.resourceType,
      resource_id: params.resourceId ?? null,
      feature_key: params.featureKey ?? null,
    },
  });
  const data = {
    id_entreprise: params.enterpriseId,
    effect: params.effect,
    role_projet: params.roleProjet ?? null,
    granted_by_id: params.grantedById ?? null,
  };
  if (existing) {
    await db.utilisateur_access_grant.update({
      where: { id_grant: existing.id_grant },
      data,
    });
    return;
  }
  await db.utilisateur_access_grant.create({
    data: {
      id_utilisateur: params.userId,
      resource_type: params.resourceType,
      resource_id: params.resourceId ?? null,
      feature_key: params.featureKey ?? null,
      ...data,
    },
  });
}

export async function clearAccessGrant(params: {
  userId: number;
  resourceType: AccessResourceType;
  resourceId?: number | null;
  featureKey?: string | null;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const db = params.tx ?? prisma;
  await db.utilisateur_access_grant.deleteMany({
    where: {
      id_utilisateur: params.userId,
      resource_type: params.resourceType,
      resource_id: params.resourceId ?? null,
      feature_key: params.featureKey ?? null,
    },
  });
}
