import { Request, Response } from "express";
import  prisma  from "../prisma/prismaClient";

export const createPermissions = async (req: Request, res: Response) => {
  try {
    const permissions = req.body; 

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({ message: "Body doit être un array de permissions" });
    }

    const created = await prisma.permission.createMany({
      data: permissions,
      skipDuplicates: true
    });

    const allPermissions = await prisma.permission.findMany({
      where: { nom: { in: permissions.map((p: any) => p.nom) } }
    });

    res.json({ message: "Permissions créées", permissions: allPermissions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
export const getPermissions = async (req: Request, res: Response) => {
  try {
    const permissions = await prisma.permission.findMany();
    res.json(permissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
