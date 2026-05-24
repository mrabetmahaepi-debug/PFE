import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";
import {
  PERMISSIONS,
  buildPermissionGroups,
} from "../modules/permissions/permissions.catalog";
import { isEnterpriseAdmin, isSuperAdmin } from "../middleware/permissions";
import { getTenantAdminRiskSummary } from "../services/tenantAdminRisk.service";
import {
  isAdminAccountType,
  isUtilisateurAccountType,
} from "../lib/permissionProfiles";
import { resolveProjectPosteLabel } from "../lib/projectRoleLabels";
import { resolvePermissionsForUserProfile } from "../services/permissionProfile.service";

/**
 * GET /api/me/permissions
 * Returns the current user's effective permissions for the frontend
 * permission system: flat list, grouped catalog, role context, and
 * SuperAdmin flag.
 */
export const getMyPermissions = async (req: Request, res: Response) => {
  try {
    const tokenUser = (req as any).user;
    if (!tokenUser) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    const superAdmin = isSuperAdmin(tokenUser);

    const dbUser = await prisma.utilisateur.findUnique({
      where: { id_utilisateur: tokenUser.id },
      include: {
        role: {
          include: { permission: true } as any,
        } as any,
      } as any,
    });

    if (!dbUser) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    let permissionNames: string[];
    if (superAdmin) {
      permissionNames = PERMISSIONS.map((p) => p.name);
    } else {
      permissionNames = (((dbUser as any).role?.permission as any[]) || [])
        .map((p: any) => p.nom as string)
        .filter((n: string) => !!n && String(n).trim().length > 0);

      const roleNom = (dbUser as any).role?.nom ?? "";
      if (
        isUtilisateurAccountType(roleNom) &&
        !isAdminAccountType(roleNom) &&
        dbUser.id_entreprise != null
      ) {
        try {
          const profilePerms = await resolvePermissionsForUserProfile(
            dbUser.id_entreprise,
            dbUser.poste
          );
          permissionNames = [...new Set([...permissionNames, ...profilePerms])];
        } catch (err) {
          console.warn("[me] profile permissions merge failed:", err);
        }
      }
    }

    const permissionSet = new Set(permissionNames);

    const posteRaw =
      dbUser.poste != null ? String(dbUser.poste).trim() : "";
    const posteLabel = posteRaw ? resolveProjectPosteLabel(posteRaw) : null;

    return res.json({
      role: (dbUser as any).role?.nom ?? null,
      poste: posteLabel ?? posteRaw || null,
      id_role: dbUser.id_role ?? null,
      id_entreprise: dbUser.id_entreprise ?? null,
      isSuperAdmin: superAdmin,
      permissions: Array.from(permissionSet),
      groups: buildPermissionGroups(permissionSet),
    });
  } catch (err) {
    console.error("getMyPermissions error:", err);
    return res
      .status(500)
      .json({ message: "Erreur lors de la récupération des permissions" });
  }
};

/**
 * GET /api/me/permissions/catalog
 * Returns the FULL canonical catalog (used by the admin matrix UI).
 * Restricted to authenticated users — visibility is fine, but mutating
 * remains gated by `TEAM_MANAGE_ROLES`.
 */
export const getPermissionsCatalog = async (_req: Request, res: Response) => {
  return res.json({
    permissions: PERMISSIONS,
    groups: buildPermissionGroups(),
  });
};

/**
 * GET /api/me/admin/risk-summary
 * Tenant admin dashboard — at-risk project count and weekly trend.
 */
export const getAdminRiskSummary = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }
    if (!isSuperAdmin(user) && !isEnterpriseAdmin(user)) {
      return res.status(403).json({
        message: "Réservé aux administrateurs d'entreprise",
      });
    }

    const entId = user?.id_entreprise;
    if (entId == null) {
      return res.json({
        totalAtRisk: 0,
        weeklyDelta: 0,
        subtitle: "Projets en retard ou bloqués",
        breakdown: {
          delayedProjects: 0,
          blockedProjects: 0,
          overdueProjectDeadlines: 0,
          projectsWithOverdueTasks: 0,
          highPriorityOpen: 0,
        },
      });
    }

    const summary = await getTenantAdminRiskSummary(Number(entId));
    return res.json(summary);
  } catch (err) {
    console.error("getAdminRiskSummary error:", err);
    return res.status(500).json({
      message: "Erreur lors du calcul des risques",
    });
  }
};
