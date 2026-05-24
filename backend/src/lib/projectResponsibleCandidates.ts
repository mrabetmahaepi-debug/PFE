import { normalizeGlobalRoleNom } from "./projectAccess";
import {
  permissionSetHas,
  posteToProfileKey,
  type PermissionProfileKey,
} from "./permissionProfiles";
import { resolvePermissionsForUserProfile } from "../services/permissionProfile.service";

/** UML permissions that qualify a user as project responsible (besides Chef de projet profile). */
export const PROJECT_RESPONSIBLE_PERMISSIONS = [
  "TEAM_MANAGE",
  "SPRINT_MANAGE",
  "TASK_ASSIGN",
] as const;

/** Account statuses that must not appear in project pickers. */
const BLOCKED_ACCOUNT_STATUSES = new Set([
  "INACTIVE",
  "INACTIF",
  "DISABLED",
  "DESACTIVE",
  "SUSPENDED",
  "SUSPENDU",
  "BANNED",
  "BLOQUE",
  "DELETED",
  "SUPPRIME",
  "ARCHIVED",
  "ARCHIVE",
]);

/** True when the account is disabled / deleted (not merely invitation-pending). */
export function isBlockedUtilisateurAccount(
  statut: string | null | undefined
): boolean {
  if (statut == null || String(statut).trim() === "") return false;
  return BLOCKED_ACCOUNT_STATUSES.has(String(statut).trim().toUpperCase());
}

/** Eligible for project pickers (ACTIVE, PENDING, INVITATION_PENDING, legacy null…). */
export function isUtilisateurAccountActive(
  statut: string | null | undefined
): boolean {
  return !isBlockedUtilisateurAccount(statut);
}

/** Global tenant/platform roles that must never be project responsible pickers. */
export function isGlobalAdminRoleName(roleNom: string | null | undefined): boolean {
  const r = normalizeGlobalRoleNom(roleNom).replace(/\s/g, "");
  return (
    r === "admin" ||
    r === "administrateur" ||
    r === "superadmin" ||
    r === "super administrateur"
  );
}

export function hasChefDeProjetProfile(
  poste: string | null | undefined
): boolean {
  return posteToProfileKey(poste) === "CHEF_PROJET";
}

export function hasResponsibleCapabilityFromPermissions(
  permissions: ReadonlySet<string> | string[] | null | undefined
): boolean {
  if (!permissions) return false;
  return PROJECT_RESPONSIBLE_PERMISSIONS.some((perm) =>
    permissionSetHas(permissions, perm)
  );
}

export async function userCanBeProjectResponsible(
  id_entreprise: number,
  utilisateur: {
    poste?: string | null;
    role?: { nom?: string | null } | null;
  }
): Promise<boolean> {
  if (isGlobalAdminRoleName(utilisateur.role?.nom ?? null)) {
    return false;
  }
  if (hasChefDeProjetProfile(utilisateur.poste)) {
    return true;
  }
  const perms = await resolvePermissionsForUserProfile(
    id_entreprise,
    utilisateur.poste
  );
  return hasResponsibleCapabilityFromPermissions(perms);
}

export type ResponsibleCandidateUser = {
  id_utilisateur: number;
  nom: string | null;
  prenom: string | null;
  email: string | null;
  poste: string | null;
  statut: string | null;
  role?: { nom?: string | null } | null;
  adminOf?: { id_entreprise?: number | null } | null;
};

/** Admin / Super Admin / enterprise adminOf — never in « Ajouter un membre ». */
export function isExcludedAdminAccount(
  u: ResponsibleCandidateUser
): boolean {
  if (isGlobalAdminRoleName(u.role?.nom ?? null)) return true;
  if (u.adminOf != null && typeof u.adminOf === "object") return true;
  return false;
}

export async function filterProjectResponsibleCandidates<
  T extends ResponsibleCandidateUser
>(id_entreprise: number, users: T[]): Promise<T[]> {
  const eligible: T[] = [];
  for (const u of users) {
    if (!isUtilisateurAccountActive(u.statut)) continue;
    if (isGlobalAdminRoleName(u.role?.nom ?? null)) continue;
    if (await userCanBeProjectResponsible(id_entreprise, u)) {
      eligible.push(u);
    }
  }
  return eligible;
}

/** Profile key for API consumers (optional display). */
export function describeResponsibleProfile(
  poste: string | null | undefined
): PermissionProfileKey {
  return posteToProfileKey(poste);
}

/** Non-admin enterprise users (any permission profile / poste). Client filters displayed list. */
export function filterProjectTeamAddCandidates<
  T extends ResponsibleCandidateUser
>(users: T[], excludeUserIds: number[] = []): T[] {
  const exclude = new Set(excludeUserIds);
  return users.filter((u) => {
    if (!isUtilisateurAccountActive(u.statut)) return false;
    if (isExcludedAdminAccount(u)) return false;
    if (exclude.has(u.id_utilisateur)) return false;
    return true;
  });
}
