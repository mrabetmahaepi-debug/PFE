import { Request, Response } from "express";
import  prisma  from "../prisma/prismaClient"; 

export const createRole = async (req: Request, res: Response) => {
  try {
    const { nom, description, id_entreprise } = req.body;

    const existing = await prisma.role.findFirst({
      where: { nom, id_entreprise },
    });

    if (existing) return res.status(400).json({ message: "Role déjà existant" });

    const role = await prisma.role.create({
      data: { nom, description, id_entreprise },
    });

    res.json({ message: "Role créé", role });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getRoles = async (req: Request, res: Response) => {
  try {
const id_entreprise = parseInt(req.params.idEntreprise as string);
    const roles = await prisma.role.findMany({
      where: { id_entreprise },
      include: { permissions: true }, 
    });

    res.json(roles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateRole = async (req: Request, res: Response) => {
  try {
    const id_role = parseInt(req.params.idRole as string);
    const { nom, description } = req.body;

    const existing = await prisma.role.findUnique({
      where: { id_role }
    });

    if (!existing) {
      return res.status(404).json({ message: "Role inexistant" });
    }

    const role = await prisma.role.update({
      where: { id_role },
      data: { nom, description },
    });

    res.json({ message: "Role mis à jour", role });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteRole = async (req: Request, res: Response) => {
  try {
    const id_role = parseInt(req.params.idRole as string);

    const existing = await prisma.role.findUnique({
      where: { id_role }
    });

    if (!existing) {
      return res.status(404).json({ message: "Role inexistant" });
    }

    await prisma.role.delete({
      where: { id_role }
    });

    res.json({ message: "Role supprimé" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const assignPermissionsToRole = async (req: Request, res: Response) => {
  try {
const idRole = parseInt(req.params.idRole as string);    const { permissionsIds }: { permissionsIds: number[] } = req.body;

    const roleCheck = await prisma.role.findUnique({ where: { id_role: idRole } });
    if (!roleCheck) return res.status(404).json({ message: "Role inexistant" });

    const existingPerms = await prisma.permission.findMany({
      where: { id_permission: { in: permissionsIds } }
    });

    if (existingPerms.length !== permissionsIds.length) {
      return res.status(400).json({ message: "Certaines permissions n'existent pas" });
    }

    // Assigner les permissions
    const role = await prisma.role.update({
      where: { id_role:idRole },
      data: {
        permissions: {
          set: permissionsIds.map(id => ({ id_permission: id })) 
        }
      },
      include: { permissions: true }
    });

    res.json({ message: "Permissions assignées", role });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
export const getRoleById = async (req: Request, res: Response) => {
  try {
const id_role = parseInt(req.params.idRole as string);   
    const role = await prisma.role.findUnique({
      where: { id_role },
      include: { permissions: true },
    });
    if (!role) return res.status(404).json({ message: "Role inexistant" });
    res.json(role);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
export const removePermissionsFromRole = async (req: Request, res: Response) => {
  try {
const id_role = parseInt(req.params.idRole as string);   

    const { permissionsIds }: { permissionsIds: number[] } = req.body;
      if (!permissionsIds || permissionsIds.length === 0) {
  return res.status(400).json({ message: "Aucune permission fournie" });
}
    const roleExists = await prisma.role.findUnique({ where: { id_role } });
    if (!roleExists) return res.status(404).json({ message: "Role inexistant" });

    const role = await prisma.role.update({
      where: { id_role },
      data: {
        permissions: {
          disconnect: permissionsIds.map(id => ({ id_permission: id }))
        }
      },
      include: { permissions: true }
    });

    res.json({ message: "Permissions retirées", role });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};