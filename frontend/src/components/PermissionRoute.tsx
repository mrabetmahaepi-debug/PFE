import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePermission } from "../hooks/usePermission";
import { isEnterpriseAdmin } from "../lib/permissions";

/** Routes liste / workspace : l’admin d’entreprise doit y accéder même si le JWT des permissions est incomplet. */
const TENANT_PROJECT_ROUTE_ANY = new Set(["PROJECT_VIEW_ALL", "WORKSPACE_VIEW"]);

interface PermissionRouteProps {
  children: React.ReactNode;
  /** Required permission. If not provided, fallback to `any`/`all`. */
  permission?: string;
  any?: string[];
  all?: string[];
  /** Redirect target when access is denied. Defaults to "/". */
  redirectTo?: string;
}

/**
 * Route-level guard that combines auth + permission check.
 * Shows a spinner while auth is initializing, redirects to /login if
 * unauthenticated, and to `redirectTo` if the permission is missing.
 */
const PermissionRoute: React.FC<PermissionRouteProps> = ({
  children,
  permission,
  any,
  all,
  redirectTo = "/home",
}) => {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const { can, canAny, canAll, isSuperAdmin } = usePermission();

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <span>Chargement…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isSuperAdmin) {
    return <>{children}</>;
  }

  const teamAdminPath =
    pathname === "/team" || pathname.startsWith("/team/");

  if (teamAdminPath && !isEnterpriseAdmin(user)) {
    return <Navigate to={redirectTo} replace />;
  }

  const tenantProjectPath =
    pathname === "/projects" || pathname.startsWith("/projects/");

  if (
    isEnterpriseAdmin(user) &&
    tenantProjectPath &&
    any &&
    any.some((p) => TENANT_PROJECT_ROUTE_ANY.has(p))
  ) {
    return <>{children}</>;
  }

  if (
    isEnterpriseAdmin(user) &&
    tenantProjectPath &&
    user?.id_entreprise != null &&
    (any || permission || all)
  ) {
    return <>{children}</>;
  }

  let allowed = true;
  if (permission) allowed = can(permission);
  else if (any && any.length > 0) allowed = canAny(any);
  else if (all && all.length > 0) allowed = canAll(all);

  if (!allowed) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default PermissionRoute;
