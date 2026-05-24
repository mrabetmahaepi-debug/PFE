import prisma from "../prisma/prismaClient";
import { getDefaultFeatureKeysForPoste } from "../lib/defaultRoleFeaturePermissions";
import { resolveProjectPosteLabel } from "../lib/projectRoleLabels";
import { upsertAccessGrant } from "../lib/userAccessGrants";

export type ProvisionDefaultPermissionsInput = {
  userId: number;
  enterpriseId: number;
  poste: string | null | undefined;
  grantedById?: number | null;
};

function isMissingAccessGrantTableError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  if (code === "P2021" || code === "P2022") return true;
  const msg = String((err as { message?: string })?.message ?? "").toLowerCase();
  return (
    msg.includes("utilisateur_access_grants") &&
    (msg.includes("does not exist") || msg.includes("doesn't exist"))
  );
}

/**
 * Seeds role-based platform permissions for a new user.
 * Does NOT assign project membership — projects are granted manually by an admin.
 */
export async function provisionDefaultRolePermissions(
  input: ProvisionDefaultPermissionsInput
): Promise<{ featureKeys: string[] }> {
  const { userId, enterpriseId, grantedById } = input;
  if (!Number.isFinite(userId) || userId <= 0) return { featureKeys: [] };
  if (!Number.isFinite(enterpriseId) || enterpriseId <= 0) return { featureKeys: [] };

  const poste = resolveProjectPosteLabel(input.poste);
  const featureKeys = getDefaultFeatureKeysForPoste(poste);

  try {
    const existing = await prisma.utilisateur_access_grant.findMany({
      where: {
        id_utilisateur: userId,
        id_entreprise: enterpriseId,
        resource_type: "FEATURE",
      },
      select: { feature_key: true },
    });

    const existingKeys = new Set(
      existing.map((row) => row.feature_key).filter(Boolean) as string[]
    );

    for (const featureKey of featureKeys) {
      if (existingKeys.has(featureKey)) continue;
      await upsertAccessGrant({
        userId,
        enterpriseId,
        resourceType: "FEATURE",
        featureKey,
        effect: "GRANT",
        grantedById: grantedById ?? null,
      });
    }
  } catch (err) {
    if (isMissingAccessGrantTableError(err)) {
      console.warn(
        "[provisionDefaultRolePermissions] Table utilisateur_access_grants missing — run prisma migrate deploy"
      );
      return { featureKeys: [] };
    }
    throw err;
  }

  return { featureKeys };
}

/** @deprecated Use provisionDefaultRolePermissions — no longer grants project access. */
export const provisionDefaultRoleAccess = provisionDefaultRolePermissions;
