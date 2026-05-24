import {
  DEFAULT_PROFILE_PERMISSIONS,
  normalizePermissionList,
  posteToProfileKey,
  type PermissionProfileKey,
} from "../lib/permissionProfiles";
import { getEnterpriseProjectRoleMatrix } from "./enterpriseProjectRoleConfig.service";

/**
 * Effective UML permissions for a Utilisateur from their assigned profile (poste).
 */
export async function resolvePermissionsForUserProfile(
  id_entreprise: number | null | undefined,
  poste: string | null | undefined
): Promise<string[]> {
  if (id_entreprise == null || !Number.isFinite(Number(id_entreprise))) {
    return [];
  }
  const profileKey = posteToProfileKey(poste);
  const matrix = await getEnterpriseProjectRoleMatrix(Number(id_entreprise));
  const fromMatrix = matrix[profileKey];
  if (fromMatrix?.length) {
    return normalizePermissionList(fromMatrix);
  }
  return [...DEFAULT_PROFILE_PERMISSIONS[profileKey]];
}

export function getDefaultProfilePermissions(
  profileKey: PermissionProfileKey
): string[] {
  return [...DEFAULT_PROFILE_PERMISSIONS[profileKey]];
}
