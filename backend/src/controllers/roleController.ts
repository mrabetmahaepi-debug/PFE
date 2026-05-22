import { Request, Response } from "express";
import  prisma  from "../prisma/prismaClient";
import { isSuperAdmin } from "../middleware/permissions";
import { SYSTEM_ONLY_PERMISSION_NAMES } from "../modules/permissions/permissions.catalog";

const SYSTEM_ROLE_NAMES = new Set(["SuperAdmin"]);

/** Helper: ensure caller can mutate a role given its id_role. */
async function loadRoleAndCheckTenant(
  req: Request,
  res: Response,
  roleId: number
): Promise<any | null> {
  if (!Number.isFinite(roleId) || roleId <= 0) {
    res.status(400).json({ message: "ID de rôle invalide" });
    return null;
  }
  const role = await prisma.role.findUnique({ where: { id_role: roleId } });
  if (!role) {
    res.status(404).json({ message: "Role inexistant" });
    return null;
  }
  const user = (req as any).user;
  const su = isSuperAdmin(user);
  if (role.nom && SYSTEM_ROLE_NAMES.has(role.nom) && !su) {
    res.status(403).json({ message: "Le rôle système ne peut pas être modifié" });
    return null;
  }
  if (!su && role.id_entreprise !== user?.id_entreprise) {
    res.status(403).json({ message: "Ce rôle n'appartient pas à votre entreprise" });
    return null;
  }
  return role;
}

export const createRole = async (req: Request, res: Response) => {
  try {
    const { nom, description } = req.body;
    let { id_entreprise } = req.body;

    const user = (req as any).user;
    const su = isSuperAdmin(user);

    // Non-SuperAdmin can only create roles inside their own enterprise
    if (!su) {
      id_entreprise = user?.id_entreprise;
      if (!id_entreprise) {
        return res
          .status(403)
          .json({ message: "Aucune entreprise associée à votre compte" });
      }
    }

    if (!nom || typeof nom !== "string") {
      return res.status(400).json({ message: "Nom de rôle requis" });
    }

    if (SYSTEM_ROLE_NAMES.has(nom) && !su) {
      return res
        .status(403)
        .json({ message: "Ce nom de rôle est réservé au système" });
    }

    const existing = await prisma.role.findFirst({
      where: { nom, id_entreprise },
    });

    if (existing) return res.status(400).json({ message: "Role déjà existant" });

    const role = await prisma.role.create({
      data: { nom, description, id_entreprise },
    });

    res.json({ message: "Role créé", role });
  } catch (error: any) {
    console.error("createRole error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lightweight tenant-scoped role list for assignment flows (invitations,
 * member creation). Returns only `id_role`, `nom`, `description`, no
 * permissions, and excludes system-only roles like SuperAdmin.
 *
 * Accessible to any user with `TEAM_INVITE` or `TEAM_MANAGE_ROLES`, so
 * tenant admins can see the dynamic list of roles available in their
 * enterprise without needing full role management rights.
 */
export const getAssignableRoles = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const su = isSuperAdmin(user);

    if (!su && !user?.id_entreprise) {
      return res
        .status(403)
        .json({ message: "Aucune entreprise associée à votre compte" });
    }

    const where: any = {
      nom: { notIn: Array.from(SYSTEM_ROLE_NAMES) },
    };
    if (!su) where.id_entreprise = user.id_entreprise;

    const roles = await prisma.role.findMany({
      where,
      select: {
        id_role: true,
        nom: true,
        description: true,
        id_entreprise: true,
      },
      orderBy: [{ nom: "asc" }],
    });

    const MEMBER_ONLY = new Set(["membre", "member"]);
    const rolesFiltered = su
      ? roles
      : roles.filter((r) => MEMBER_ONLY.has((r.nom || "").trim().toLowerCase()));

    return res.json(rolesFiltered);
  } catch (error: any) {
    console.error("getAssignableRoles error:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const getRoles = async (req: Request, res: Response) => {
  try {
    const id_entreprise = parseInt(req.params.idEntreprise as string);
    if (!Number.isFinite(id_entreprise) || id_entreprise <= 0) {
      return res.status(400).json({ message: "ID entreprise invalide" });
    }

    const user = (req as any).user;
    if (!isSuperAdmin(user) && user?.id_entreprise !== id_entreprise) {
      return res
        .status(403)
        .json({ message: "Vous ne pouvez consulter que votre entreprise" });
    }

    const roles = await prisma.role.findMany({
      where: { id_entreprise },
      include: { permission: true } as any,
    });

    res.json(roles);
  } catch (error: any) {
    console.error("getRoles error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const updateRole = async (req: Request, res: Response) => {
  try {
    const id_role = parseInt(req.params.idRole as string);
    const guarded = await loadRoleAndCheckTenant(req, res, id_role);
    if (!guarded) return;

    const { nom, description } = req.body;
    const user = (req as any).user;
    const su = isSuperAdmin(user);

    if (nom && SYSTEM_ROLE_NAMES.has(nom) && !su) {
      return res
        .status(403)
        .json({ message: "Ce nom de rôle est réservé au système" });
    }

    const role = await prisma.role.update({
      where: { id_role },
      data: { nom, description },
    });

    res.json({ message: "Role mis à jour", role });
  } catch (error: any) {
    console.error("updateRole error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteRole = async (req: Request, res: Response) => {
  try {
    const id_role = parseInt(req.params.idRole as string);
    const guarded = await loadRoleAndCheckTenant(req, res, id_role);
    if (!guarded) return;

    await prisma.role.delete({ where: { id_role } });

    res.json({ message: "Role supprimé" });
  } catch (error: any) {
    console.error("deleteRole error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const assignPermissionsToRole = async (req: Request, res: Response) => {
  try {
    const idRole = parseInt(req.params.idRole as string);
    const guarded = await loadRoleAndCheckTenant(req, res, idRole);
    if (!guarded) return;

    const { permissionsIds }: { permissionsIds: number[] } = req.body;
    if (!Array.isArray(permissionsIds)) {
      return res.status(400).json({ message: "permissionsIds doit être un tableau" });
    }

    const ids = permissionsIds.map((x) => Number.parseInt(String(x), 10));
    if (ids.some((id) => !Number.isFinite(id) || id <= 0)) {
      return res.status(400).json({ message: "permissionsIds contient des valeurs invalides" });
    }

    const user = (req as any).user;
    const su = isSuperAdmin(user);

    const existingPerms = await prisma.permission.findMany({
      where: { id_permission: { in: ids } },
    });

    if (existingPerms.length !== ids.length) {
      return res.status(400).json({ message: "Certaines permissions n'existent pas" });
    }

    if (!su) {
      for (const p of existingPerms) {
        if (p.nom && SYSTEM_ONLY_PERMISSION_NAMES.has(p.nom)) {
          return res.status(403).json({
            message:
              "Les permissions réservées au système ne peuvent pas être assignées depuis ce compte",
          });
        }
      }
    }

    const role = await prisma.role.update({
      where: { id_role: idRole },
      data: {
        permission: {
          set: ids.map((id) => ({ id_permission: id })),
        },
      } as any,
      include: { permission: true } as any,
    });

    res.json({ message: "Permissions assignées", role });
  } catch (error: any) {
    console.error("assignPermissionsToRole error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getRoleById = async (req: Request, res: Response) => {
  try {
    const id_role = parseInt(req.params.idRole as string);
    if (!Number.isFinite(id_role) || id_role <= 0) {
      return res.status(400).json({ message: "ID de rôle invalide" });
    }
    const role = await prisma.role.findUnique({
      where: { id_role },
      include: { permission: true } as any,
    });
    if (!role) return res.status(404).json({ message: "Role inexistant" });

    const user = (req as any).user;
    if (!isSuperAdmin(user) && role.id_entreprise !== user?.id_entreprise) {
      return res
        .status(403)
        .json({ message: "Ce rôle n'appartient pas à votre entreprise" });
    }

    res.json(role);
  } catch (error: any) {
    console.error("getRoleById error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const removePermissionsFromRole = async (req: Request, res: Response) => {
  try {
    const id_role = parseInt(req.params.idRole as string);
    const guarded = await loadRoleAndCheckTenant(req, res, id_role);
    if (!guarded) return;

    const { permissionsIds }: { permissionsIds: number[] } = req.body;
    if (!Array.isArray(permissionsIds) || permissionsIds.length === 0) {
      return res.status(400).json({ message: "Aucune permission fournie" });
    }

    const ids = permissionsIds.map((x) => Number.parseInt(String(x), 10));
    if (ids.some((id) => !Number.isFinite(id) || id <= 0)) {
      return res.status(400).json({ message: "permissionsIds contient des valeurs invalides" });
    }

    const role = await prisma.role.update({
      where: { id_role },
      data: {
        permission: {
          disconnect: ids.map((id) => ({ id_permission: id })),
        },
      } as any,
      include: { permission: true } as any,
    });

    res.json({ message: "Permissions retirées", role });
  } catch (error: any) {
    console.error("removePermissionsFromRole error:", error);
    res.status(500).json({ error: error.message });
  }
};