import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";

export const assignPermissionToRole = async (req: Request, res: Response) => {
  try {
    const { roleId, permissionId } = req.body;

    const updatedRole = await prisma.role.update({
      where: { id_role: parseInt(roleId as any) },
      data: {
        permissions: {
          connect: { id_permission: parseInt(permissionId as any) }
        }
      },
      include: { permissions: true }
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
        permissions: {
          disconnect: { id_permission: parseInt(permissionId as any) }
        }
      },
      include: { permissions: true }
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
      include: { permissions: true }
    });
    res.json(role?.permissions || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
