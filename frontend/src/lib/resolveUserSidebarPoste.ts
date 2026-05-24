import type { User } from '../types/auth.types';
import { isEnterpriseAdmin, isSuperAdmin } from './permissions';
import { resolveProjectPosteLabel } from './projectRoleLabels';

/**
 * Label shown under the user name in the sidebar footer (display only).
 * Uses the assigned permission profile (`utilisateur.poste`), not project roles
 * or global « Membre » — access control remains permission-based.
 */
export function resolveUserSidebarPoste(params: {
  user: User | null | undefined;
}): string {
  const { user } = params;
  if (!user) return 'Utilisateur';

  if (isSuperAdmin(user)) return 'Super Admin';
  if (isEnterpriseAdmin(user)) return 'Admin';

  const posteRaw = user.poste?.trim();
  if (posteRaw) {
    return resolveProjectPosteLabel(posteRaw);
  }

  return 'Utilisateur';
}
