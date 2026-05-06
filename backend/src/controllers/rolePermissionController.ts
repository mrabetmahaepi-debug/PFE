import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";

export const assignPermissionToRole = async (req: Request, res: Response) => {
  try {
    const { roleId, permissionId } = req.body;

    const updatedRole = await prisma.role.update({
      where: { id_role: parseInt(roleId as any) },
      data: {
        permission: {
          connect: { id_permission: parseInt(permissionId as any) }
        }
      } as any,
      include: { permission: true } as any
    });

    res.json({ message: "Permission assignée au rôle", role: updatedRole });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const removePermissionFromRole = async (req: Request, res: Response) => {
  try {
    const { roleId, permissionId } = req.body;

    const updatedRole = await prisma.role.update({
      where: { id_role: parseInt(roleId as any) },
      data: {
        permission: {
          disconnect: { id_permission: parseInt(permissionId as any) }
        }
      } as any,
      include: { permission: true } as any
    });

    res.json({ message: "Permission retirée du rôle", role: updatedRole });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getRolePermissions = async (req: Request, res: Response) => {
  try {
    const { roleId } = req.params;
    const role = await prisma.role.findUnique({
      where: { id_role: parseInt(roleId as any) },
      include: { permission: true } as any
    });
    res.json((role as any)?.permission || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
