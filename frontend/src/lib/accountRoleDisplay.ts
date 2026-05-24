import type { User } from '../types/auth.types';
import { resolveProjectPosteLabel } from './projectRoleLabels';

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

/**
 * Label shown in admin Team tables and profile headers.
 * Prefers `utilisateur.poste` (Chef de projet, Développeur, …) over generic global « Membre ».
 */
export function displayGlobalAccountRole(member: User | null | undefined): string {
  if (!member) return 'Membre';

  const globalNom = rawGlobalRoleNom(member);
  const globalKey = normalizeRoleKey(globalNom);

  if (globalKey === 'SUPERADMIN') return 'Super Admin';
  if (
    globalKey === 'ADMIN' ||
    globalKey === 'ADMINISTRATEUR' ||
    globalKey === 'ADMINENTREPRISE'
  ) {
    return 'Admin';
  }

  const posteRaw = member.poste?.trim();
  if (posteRaw) {
    return resolveProjectPosteLabel(posteRaw);
  }

  if (!globalNom) return 'Membre';
  if (globalKey === 'MEMBRE' || globalKey === 'MEMBER') return 'Membre';
  return globalNom;
}

/** True when global tenant role is generic Membre (poste may still be Chef de projet, etc.). */
export function isGenericGlobalMembreRole(member: User | null | undefined): boolean {
  const key = normalizeRoleKey(rawGlobalRoleNom(member));
  return !key || key === 'MEMBRE' || key === 'MEMBER';
}
