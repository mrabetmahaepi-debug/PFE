import type { User } from '../types/auth.types';
import {
  isChefDeProjetMemberRole,
  resolveProjectPosteLabel,
} from './projectRoleLabels';
import { isEnterpriseAdmin, isSuperAdmin } from './permissions';

export function normalizeRoleKey(nom: string): string {
  return String(nom ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]/g, '');
}

export function rawGlobalRoleNom(member: User | null | undefined): string {
  if (!member) return '';
  const raw = typeof member.role === 'object' ? member.role?.nom : member.role;
  return String(raw ?? '').trim();
}

const GLOBAL_ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Super Admin',
  ADMIN: 'Admin',
  ADMINISTRATEUR: 'Admin',
  ADMINENTREPRISE: 'Admin',
  CHEFPROJET: 'Chef de projet',
  CHEFDEPROJET: 'Chef de projet',
  DEVELOPPEUR: 'Développeur',
  DEVELOPER: 'Développeur',
  MEMBRE: 'Membre',
  MEMBER: 'Membre',
};

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function readStoredGlobalRoleNom(): string {
  try {
    return String(localStorage.getItem('role') ?? '').trim();
  } catch {
    return '';
  }
}

/** Merge session user with cached localStorage fields when the live object is incomplete. */
export function mergeUserWithCachedSession(
  user: User | null | undefined
): User | null {
  const cached = readCachedUser();
  if (!user && !cached) return null;
  if (!user) return cached;
  if (!cached) return user;

  return {
    ...cached,
    ...user,
    poste: user.poste?.trim() || cached.poste?.trim() || undefined,
    role: user.role ?? cached.role ?? (readStoredGlobalRoleNom() || undefined),
    projectRoles: user.projectRoles?.length ? user.projectRoles : cached.projectRoles,
    isSuperAdmin: user.isSuperAdmin ?? cached.isSuperAdmin,
    permissions: user.permissions?.length ? user.permissions : cached.permissions,
  };
}

function labelFromGlobalRoleKey(globalKey: string): string | null {
  if (!globalKey) return null;
  const mapped = GLOBAL_ROLE_LABELS[globalKey];
  if (mapped) return mapped;
  return null;
}

function inferRoleFromProjectRoles(
  projectRoles: User['projectRoles']
): string | null {
  if (!projectRoles?.length) return null;

  if (projectRoles.some((r) => isChefDeProjetMemberRole(r.role_projet))) {
    return 'Chef de projet';
  }

  const devHit = projectRoles.find((r) => {
    const key = normalizeRoleKey(r.role_projet);
    return key === 'DEVELOPPEUR' || key === 'DEVELOPER';
  });
  if (devHit) return 'Développeur';

  for (const row of projectRoles) {
    const label = resolveProjectPosteLabel(row.role_projet);
    if (label && label !== 'Membre') return label;
  }

  return null;
}

export interface ResolveAccountRoleLabelOptions {
  /** Shown only when no role/poste/profile hint exists at all. */
  unknownLabel?: string;
}

/**
 * Human-readable account role for sidebar, navbar, and team tables.
 * Prefers `utilisateur.poste`, then global role codes (ADMIN, CHEF_PROJET, …),
 * then project membership roles, then cached session data.
 */
export function resolveAccountRoleLabel(
  member: User | null | undefined,
  options: ResolveAccountRoleLabelOptions = {}
): string {
  const unknownLabel = options.unknownLabel ?? 'Utilisateur';
  const effective = mergeUserWithCachedSession(member);
  if (!effective) return unknownLabel;

  if (isSuperAdmin(effective)) return 'Super Admin';
  if (isEnterpriseAdmin(effective)) return 'Admin';

  const posteRaw = effective.poste?.trim();
  if (posteRaw) {
    return resolveProjectPosteLabel(posteRaw);
  }

  const globalNom = rawGlobalRoleNom(effective) || readStoredGlobalRoleNom();
  const globalKey = normalizeRoleKey(globalNom);
  const fromGlobal = labelFromGlobalRoleKey(globalKey);
  if (fromGlobal && globalKey !== 'MEMBRE' && globalKey !== 'MEMBER') {
    return fromGlobal;
  }

  const fromProjects = inferRoleFromProjectRoles(effective.projectRoles);
  if (fromProjects) return fromProjects;

  if (fromGlobal) return fromGlobal;
  if (globalNom) return globalNom;

  return unknownLabel;
}

/**
 * Label shown in admin Team tables and profile headers.
 * Prefers `utilisateur.poste` (Chef de projet, Développeur, …) over generic global « Membre ».
 */
export function displayGlobalAccountRole(member: User | null | undefined): string {
  return resolveAccountRoleLabel(member, { unknownLabel: 'Membre' });
}

/** True when global tenant role is generic Membre (poste may still be Chef de projet, etc.). */
export function isGenericGlobalMembreRole(member: User | null | undefined): boolean {
  const key = normalizeRoleKey(rawGlobalRoleNom(member));
  return !key || key === 'MEMBRE' || key === 'MEMBER';
}
