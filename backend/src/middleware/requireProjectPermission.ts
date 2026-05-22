import type { Request, RequestHandler } from "express";
import {
  getProjectPermissionContext,
  hasProjectPermission,
} from "../services/projectPermission.service";

export type ProjectIdResolver = (req: Request) => Promise<number | null | undefined>;

/**
 * Resolves `projectId`, loads {@link getProjectPermissionContext} into `req.projectPermissionContext`,
 * then enforces a single permission (unless user has fullAccess).
 */
export function requireProjectPermission(
  permission: string,
  resolveProjectId: ProjectIdResolver
): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ message: "Utilisateur non authentifié" });
      }
      const raw = await resolveProjectId(req);
      const projectId = raw == null ? NaN : Number(raw);
      if (!Number.isFinite(projectId) || projectId < 1) {
        return res.status(400).json({ message: "Identifiant de projet invalide" });
      }
      const ctx = await getProjectPermissionContext(user, projectId);
      (req as any).projectPermissionContext = ctx;
      if (!hasProjectPermission(ctx, permission)) {
        return res.status(403).json({
          message: "Permission projet insuffisante",
          code: "PROJECT_PERMISSION_DENIED",
          requiredPermission: permission,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireAnyProjectPermission(
  permissions: string[],
  resolveProjectId: ProjectIdResolver
): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ message: "Utilisateur non authentifié" });
      }
      const raw = await resolveProjectId(req);
      const projectId = raw == null ? NaN : Number(raw);
      if (!Number.isFinite(projectId) || projectId < 1) {
        return res.status(400).json({ message: "Identifiant de projet invalide" });
      }
      const ctx = await getProjectPermissionContext(user, projectId);
      (req as any).projectPermissionContext = ctx;
      if (ctx.fullAccess) {
        return next();
      }
      const ok = permissions.some((p) => hasProjectPermission(ctx, p));
      if (!ok) {
        return res.status(403).json({
          message: "Permission projet insuffisante",
          code: "PROJECT_PERMISSION_DENIED",
          requiredPermission: permissions,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
