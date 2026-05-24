import type { User } from '../types/auth.types';
import { rawGlobalRoleNom, normalizeRoleKey } from './accountRoleDisplay';
import { isEnterpriseAdmin, isSuperAdmin } from './permissions';
import { normalizePickerUser, normalizePickerUserList, pickerUserId } from './userPickerDisplay';

const BLOCKED_ACCOUNT_STATUSES = new Set([
  'INACTIVE',
  'INACTIF',
  'DISABLED',
  'DESACTIVE',
  'SUSPENDED',
  'SUSPENDU',
  'BANNED',
  'BLOQUE',
  'DELETED',
  'SUPPRIME',
  'ARCHIVED',
  'ARCHIVE',
]);

type UserWithAdminOf = User & {
  adminOf?: { id_entreprise?: number | null; nom?: string | null } | null;
};

export function isBlockedAccountStatus(statut: string | null | undefined): boolean {
  if (statut == null || String(statut).trim() === '') return false;
  return BLOCKED_ACCOUNT_STATUSES.has(String(statut).trim().toUpperCase());
}

/**
 * Global Admin, Super Admin, or enterprise responsible admin (adminOf).
 * Must never appear in « Ajouter un membre ».
 */
export function isExcludedAdminAccount(user: User | null | undefined): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (isEnterpriseAdmin(user)) return true;

  const adminOf = (user as UserWithAdminOf).adminOf;
  if (adminOf != null && typeof adminOf === 'object') return true;

  const key = normalizeRoleKey(rawGlobalRoleNom(user));
  if (key === 'SUPERADMIN') return true;
  if (key === 'ADMIN' || key === 'ADMINISTRATEUR' || key === 'ADMINENTREPRISE') {
    return true;
  }

  return false;
}

export type ProjectMemberAddFilterOptions = {
  /** Connected user — excluded when they are an admin account. */
  sessionUser?: User | null;
};

/**
 * Enterprise users eligible for « Ajouter un membre ».
 * Chef de projet, Développeur, or any custom non-admin profile.
 */
export function filterUsersForProjectMemberAdd(
  users: User[],
  displayedMemberIds: Iterable<number>,
  options?: ProjectMemberAddFilterOptions
): User[] {
  const displayed = new Set(displayedMemberIds);
  const sessionId =
    options?.sessionUser && isExcludedAdminAccount(options.sessionUser)
      ? pickerUserId(options.sessionUser)
      : 0;

  return normalizePickerUserList(users).filter((u) => {
    const id = pickerUserId(u);
    if (id <= 0) return false;
    if (displayed.has(id)) return false;
    if (isExcludedAdminAccount(u)) return false;
    if (sessionId > 0 && id === sessionId) return false;
    if (isBlockedAccountStatus(u.statut)) return false;
    return true;
  });
}
