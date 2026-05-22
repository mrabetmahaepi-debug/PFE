import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";
import { isSuperAdmin } from "../middleware/permissions";
import { SYSTEM_ONLY_PERMISSION_NAMES } from "../modules/permissions/permissions.catalog";
import { logEnterpriseAdminActivity } from "../services/enterpriseActivity.service";

const SYSTEM_ROLE_NAMES = new Set(["SuperAdmin"]);

/**
 * Tenant-scoped guard for role-permission mutations.
 * - SuperAdmin can mutate any role.
 * - Anyone else can only mutate roles inside their own enterprise.
 * - SuperAdmin role is read-only for non-SuperAdmins.
 */
async function ensureCanMutateRole(
  req: Request,
  res: Response,
  roleId: number
): Promise<{ ok: true; role: any } | { ok: false }> {
  if (!Number.isFinite(roleId) || roleId <= 0) {
    res.status(400).json({ message: "roleId invalide" });
    return { ok: false };
  }

  const role = await prisma.role.findUnique({ where: { id_role: roleId } });
  if (!role) {
    res.status(404).json({ message: "Rôle introuvable" });
    return { ok: false };
  }

  const user = (req as any).user;
  const su = isSuperAdmin(user);

  if (role.nom && SYSTEM_ROLE_NAMES.has(role.nom) && !su) {
    res
      .status(403)
      .json({ message: "Le rôle système ne peut pas être modifié" });
    return { ok: false };
  }

  if (!su && role.id_entreprise !== user?.id_entreprise) {
    res
      .status(403)
      .json({ message: "Ce rôle n'appartient pas à votre entreprise" });
    return { ok: false };
  }

  return { ok: true, role };
}

export const assignPermissionToRole = async (req: Request, res: Response) => {
  try {
    const roleId = parseInt(String(req.body.roleId), 10);
    const permissionId = parseInt(String(req.body.permissionId), 10);
    if (!Number.isFinite(permissionId) || permissionId <= 0) {
      return res.status(400).json({ message: "permissionId invalide" });
    }

    const guard = await ensureCanMutateRole(req, res, roleId);
    if (!guard.ok) return;

    const permRow = await prisma.permission.findUnique({
      where: { id_permission: permissionId },
    });
    if (!permRow) {
      return res.status(400).json({ message: "Permission introuvable" });
    }
    if (
      !isSuperAdmin((req as any).user) &&
      permRow.nom &&
      SYSTEM_ONLY_PERMISSION_NAMES.has(permRow.nom)
    ) {
      return res.status(403).json({
        message:
          "Cette permission est réservée au SuperAdmin et ne peut pas être assignée depuis ce compte",
      });
    }

    const updatedRole = await prisma.role.update({
      where: { id_role: roleId },
      data: {
        permission: { connect: { id_permission: permissionId } },
      } as any,
      include: { permission: true } as any,
    });

    const actor = (req as any).user;
    if (guard.role.id_entreprise && !isSuperAdmin(actor)) {
      const ent = await prisma.entreprise.findUnique({
        where: { id_entreprise: guard.role.id_entreprise },
        select: { nom: true },
      });
      const actorRow = actor?.id
        ? await prisma.utilisateur.findUnique({
            where: { id_utilisateur: actor.id },
            select: { prenom: true, nom: true, email: true },
          })
        : null;
      const actorName = actorRow
        ? `${actorRow.prenom || ""} ${actorRow.nom || ""}`.trim() ||
          actorRow.email ||
          "Administration"
        : "Administration";
      await logEnterpriseAdminActivity({
        enterpriseName: ent?.nom || "Entreprise",
        user: actorName,
        action: `Permission assignée — ${permRow.nom}`,
        type: "access",
        entityId: roleId,
        status: "ACTIVE",
      });
    }

    res.json({ message: "Permission assignée au rôle", role: updatedRole });
  } catch (error: any) {
    console.error("assignPermissionToRole error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const removePermissionFromRole = async (req: Request, res: Response) => {
  try {
    const roleId = parseInt(String(req.body.roleId), 10);
    const permissionId = parseInt(String(req.body.permissionId), 10);
    if (!Number.isFinite(permissionId) || permissionId <= 0) {
      return res.status(400).json({ message: "permissionId invalide" });
    }

    const guard = await ensureCanMutateRole(req, res, roleId);
    if (!guard.ok) return;

    const permRow = await prisma.permission.findUnique({
      where: { id_permission: permissionId },
    });

    const updatedRole = await prisma.role.update({
      where: { id_role: roleId },
      data: {
        permission: { disconnect: { id_permission: permissionId } },
      } as any,
      include: { permission: true } as any,
    });

    const actor = (req as any).user;
    if (guard.role.id_entreprise && !isSuperAdmin(actor) && permRow) {
      const ent = await prisma.entreprise.findUnique({
        where: { id_entreprise: guard.role.id_entreprise },
        select: { nom: true },
      });
      const actorRow = actor?.id
        ? await prisma.utilisateur.findUnique({
            where: { id_utilisateur: actor.id },
            select: { prenom: true, nom: true, email: true },
          })
        : null;
      const actorName = actorRow
        ? `${actorRow.prenom || ""} ${actorRow.nom || ""}`.trim() ||
          actorRow.email ||
          "Administration"
        : "Administration";
      await logEnterpriseAdminActivity({
        enterpriseName: ent?.nom || "Entreprise",
        user: actorName,
        action: `Permission retirée — ${permRow.nom}`,
        type: "access",
        entityId: roleId,
        status: "ACTIVE",
      });
    }

    res.json({ message: "Permission retirée du rôle", role: updatedRole });
  } catch (error: any) {
    console.error("removePermissionFromRole error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getRolePermissions = async (req: Request, res: Response) => {
  try {
    const roleId = parseInt(String(req.params.roleId), 10);
    if (!Number.isFinite(roleId) || roleId <= 0) {
      return res.status(400).json({ message: "roleId invalide" });
    }

    const role = await prisma.role.findUnique({
      where: { id_role: roleId },
      include: { permission: true } as any,
    });

    if (!role) {
      return res.status(404).json({ message: "Rôle introuvable" });
    }

    const user = (req as any).user;
    const su = isSuperAdmin(user);
    if (!su && role.id_entreprise !== user?.id_entreprise) {
      return res
        .status(403)
        .json({ message: "Ce rôle n'appartient pas à votre entreprise" });
    }

    res.json((role as any).permission || []);
  } catch (error: any) {
    console.error("getRolePermissions error:", error);
    res.status(500).json({ error: error.message });
  }
};
