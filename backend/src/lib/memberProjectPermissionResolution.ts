import type { Prisma } from "@prisma/client";
import prisma from "../prisma/prismaClient";
import {
  isValidProjectPermissionSlug,
  type ProjectPermissionKey,
} from "./projectRolePermissions";
import { isMissingAccessGrantsTable } from "./accessGrantsTable";

export type PermOverrideRow = {
  feature_key: string;
  effect: string;
};

/** Per-member permission overrides stored as utilisateur_access_grant rows. */
export async function loadMemberPermissionOverrides(
  userId: number,
  projectId: number
): Promise<PermOverrideRow[]> {
  try {
    const rows = await prisma.utilisateur_access_grant.findMany({
      where: {
        id_utilisateur: userId,
        resource_type: "PERM",
        resource_id: projectId,
        feature_key: { not: null },
      },
      select: { feature_key: true, effect: true },
    });
    return rows.filter(
      (r): r is { feature_key: string; effect: string } =>
        typeof r.feature_key === "string" &&
        isValidProjectPermissionSlug(r.feature_key)
    );
  } catch (err) {
    if (isMissingAccessGrantsTable(err)) return [];
    throw err;
  }
}

/**
 * Merge role-bucket defaults with explicit PERM GRANT/DENY overrides for one member.
 */
export function mergePermissionOverrides(
  basePermissions: ReadonlySet<string>,
  overrides: PermOverrideRow[]
): Set<string> {
  const result = new Set(basePermissions);
  for (const row of overrides) {
    if (row.effect === "GRANT") result.add(row.feature_key);
    else if (row.effect === "DENY") result.delete(row.feature_key);
  }
  return result;
}

export async function upsertMemberPermissionOverride(params: {
  userId: number;
  enterpriseId: number;
  projectId: number;
  permission: ProjectPermissionKey;
  enabled: boolean;
  grantedById: number;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const db = params.tx ?? prisma;
  const existing = await db.utilisateur_access_grant.findFirst({
    where: {
      id_utilisateur: params.userId,
      resource_type: "PERM",
      resource_id: params.projectId,
      feature_key: params.permission,
    },
  });
  const effect = params.enabled ? "GRANT" : "DENY";
  if (existing) {
    await db.utilisateur_access_grant.update({
      where: { id_grant: existing.id_grant },
      data: {
        effect,
        granted_by_id: params.grantedById,
        id_entreprise: params.enterpriseId,
      },
    });
    return;
  }
  await db.utilisateur_access_grant.create({
    data: {
      id_utilisateur: params.userId,
      id_entreprise: params.enterpriseId,
      resource_type: "PERM",
      resource_id: params.projectId,
      feature_key: params.permission,
      effect,
      granted_by_id: params.grantedById,
    },
  });
}
