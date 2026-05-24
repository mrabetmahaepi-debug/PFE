import type { User } from '../types/auth.types';
import { resolveAccountRoleLabel } from './accountRoleDisplay';

/**
 * Label shown under the user name in the sidebar footer (display only).
 * Uses poste, global role, project roles, and cached session — not hard-coded « Utilisateur ».
 */
export function resolveUserSidebarPoste(params: {
  user: User | null | undefined;
}): string {
  return resolveAccountRoleLabel(params.user, { unknownLabel: 'Utilisateur' });
}
