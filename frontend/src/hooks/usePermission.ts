import { useAuth } from "./useAuth";

/**
 * Tiny ergonomic wrapper around `useAuth` that exposes the most common
 * permission helpers in one place.
 *
 * Examples:
 *   const { can } = usePermission();
 *   if (can("PROJECT_CREATE")) { ... }
 *
 *   const { canAny } = usePermission();
 *   canAny(["PROJECT_EDIT", "PROJECT_DELETE"]);
 */
export function usePermission() {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isSuperAdmin,
    refreshPermissions,
  } = useAuth();

  return {
    can: hasPermission,
    canAny: hasAnyPermission,
    canAll: hasAllPermissions,
    isSuperAdmin,
    refresh: refreshPermissions,
  };
}
