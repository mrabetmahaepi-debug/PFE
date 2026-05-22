/** Project-scoped permission slugs (mirror backend `projectRolePermissions.ts`). */
export function projectCan(
  permissions: string[] | undefined | null,
  key: string
): boolean {
  if (!permissions || permissions.length === 0) return false;
  return permissions.includes(key);
}
