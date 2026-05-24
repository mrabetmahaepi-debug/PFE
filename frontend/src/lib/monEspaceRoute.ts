import type { SpaceTreeNode } from '../types/hierarchy';
import { appPaths, parseWorkspacePath } from './workspaceRoutes';
export const MON_ESPACE_NAME = 'Mon espace';

export function isMonEspaceSpaceName(nom: string | null | undefined): boolean {
  return String(nom ?? '').trim().toLowerCase() === MON_ESPACE_NAME.toLowerCase();
}

/** Member navbar — /mon-espace redirect or space root without folder/list. */
export function isMemberMonEspaceNavbarPath(pathname: string): boolean {
  if (pathname === '/mon-espace' || pathname === '/mon-espace/') return true;
  const { spaceId, folderId, listId } = parseWorkspacePath(pathname);
  return spaceId != null && folderId == null && listId == null;
}

/** Resolve the tenant « Mon espace » space id from hierarchy (fallback: first space). */
export function findMonEspaceSpaceId(spaces: SpaceTreeNode[]): number | null {
  const named = spaces.find((s) => isMonEspaceSpaceName(s.nom));
  if (named) return named.id_space;
  return spaces[0]?.id_space ?? null;
}

export function monEspacePathFromSpaces(spaces: SpaceTreeNode[]): string {
  const id = findMonEspaceSpaceId(spaces);
  return id != null ? appPaths.space(id) : appPaths.spaces;
}
