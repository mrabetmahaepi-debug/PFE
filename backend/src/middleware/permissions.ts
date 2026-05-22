import { NextFunction, Request, Response } from "express";
import prisma from "../prisma/prismaClient";

/**
 * Consolidated authorization helpers.
 *
 * Goals:
 * - one place to check a user's permissions,
 * - one place to bypass everything for SuperAdmin,
 * - chainable middlewares for routes (`requirePermission`,
 *   `requireAnyPermission`, `requireSuperAdmin`).
 *
 * The legacy `authorize(permission)` middleware is kept as a thin
 * wrapper around `requirePermission` so existing imports keep working.
 */

export interface AuthedUser {
  id: number;
  email?: string;
  role?: string | null;
  id_role?: number | null;
  id_entreprise?: number | null;
}

/** Per-request permission cache to avoid hitting Prisma multiple times. */
type PermCache = Set<string>;

function getRequestCache(req: Request): PermCache | null {
  return (req as any).__permCache || null;
}

function setRequestCache(req: Request, cache: PermCache) {
  (req as any).__permCache = cache;
}

function getUser(req: Request): AuthedUser | null {
  return ((req as any).user as AuthedUser) || null;
}

/**
 * Collapses spaces / underscores / hyphens so labels like "Super Admin" or
 * "SUPER_ADMIN" match platform SuperAdmin checks.
 */
export function normalizeRoleForSuperAdminCompare(
  role: string | null | undefined
): string {
  return String(role ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]/g, "");
}

/** SuperAdmin detector (handles "SuperAdmin", "Super Admin", "superadmin", etc.). */
export function isSuperAdmin(user?: Pick<AuthedUser, "role"> | null): boolean {
  if (!user) return false;
  return normalizeRoleForSuperAdminCompare(user.role as string) === "SUPERADMIN";
}

/** Tenant enterprise admin (matches frontend isEnterpriseAdmin). */
export function isEnterpriseAdmin(
  user?: Pick<AuthedUser, "role" | "id_entreprise"> | null
): boolean {
  if (!user?.id_entreprise || isSuperAdmin(user)) return false;
  const norm = normalizeRoleForSuperAdminCompare(user.role as string);
  return (
    norm === "ADMIN" ||
    norm === "ADMINISTRATEUR" ||
    norm === "ADMINENTREPRISE"
  );
}

/**
 * Resolve the active set of permissions for a user.
 *
 * - SuperAdmin → returns `null` to mean "all permissions".
 * - Otherwise → loads the role by id_role first, falls back to (nom + id_entreprise).
 *
 * Result is cached on the request to be cheap to call multiple times in
 * a single handler (e.g. middleware + controller).
 */
export async function getUserPermissions(
  req: Request
): Promise<PermCache | null> {
  const user = getUser(req);
  if (!user) return new Set();

  if (isSuperAdmin(user)) return null;

  const cached = getRequestCache(req);
  if (cached) return cached;

  let roleWithPermissions: any = null;
  if (user.id_role) {
    roleWithPermissions = await prisma.role.findUnique({
      where: { id_role: user.id_role },
      include: { permission: true } as any,
    });
  } else if (user.role && user.id_entreprise) {
    roleWithPermissions = await prisma.role.findFirst({
      where: { nom: user.role, id_entreprise: user.id_entreprise },
      include: { permission: true } as any,
    });
  }

  const cache: PermCache = new Set(
    ((roleWithPermissions?.permission as any[]) || []).map(
      (p: any) => p.nom as string
    )
  );
  setRequestCache(req, cache);
  return cache;
}

/** True if the user has the permission (or is SuperAdmin). */
export async function userHasPermission(
  req: Request,
  permission: string
): Promise<boolean> {
  const perms = await getUserPermissions(req);
  if (perms === null) return true; // SuperAdmin
  return perms.has(permission);
}

/** True if the user has at least one of the listed permissions. */
export async function userHasAnyPermission(
  req: Request,
  permissions: string[]
): Promise<boolean> {
  const perms = await getUserPermissions(req);
  if (perms === null) return true;
  return permissions.some((p) => perms.has(p));
}

// ---------------------------------------------------------------------------
// Middlewares
// ---------------------------------------------------------------------------

/** Requires the request to be authenticated (mirrors authMiddleware contract). */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!getUser(req)) {
    return res.status(401).json({ message: "Utilisateur non authentifié" });
  }
  next();
}

/** Requires the user to be SuperAdmin. */
export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = getUser(req);
  if (!user) {
    return res.status(401).json({ message: "Utilisateur non authentifié" });
  }
  if (!isSuperAdmin(user)) {
    return res
      .status(403)
      .json({ message: "Accès refusé : SuperAdmin requis" });
  }
  next();
}

/** Requires a specific permission. */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      if (!user) {
        return res.status(401).json({ message: "Utilisateur non authentifié" });
      }
      if (await userHasPermission(req, permission)) return next();
      return res.status(403).json({
        message: `Accès refusé : permission '${permission}' requise`,
        code: "FORBIDDEN_MISSING_PERMISSION",
        requiredPermission: permission,
      });
    } catch (err) {
      console.error("requirePermission error:", err);
      return res
        .status(500)
        .json({ message: "Erreur lors de la vérification des permissions" });
    }
  };
}

/** Requires at least one permission from the list. */
export function requireAnyPermission(permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      if (!user) {
        return res.status(401).json({ message: "Utilisateur non authentifié" });
      }
      if (await userHasAnyPermission(req, permissions)) return next();
      return res.status(403).json({
        message: `Accès refusé : une des permissions suivantes est requise: ${permissions.join(", ")}`,
        code: "FORBIDDEN_MISSING_PERMISSION",
        requiredPermissions: permissions,
      });
    } catch (err) {
      console.error("requireAnyPermission error:", err);
      return res
        .status(500)
        .json({ message: "Erreur lors de la vérification des permissions" });
    }
  };
}
