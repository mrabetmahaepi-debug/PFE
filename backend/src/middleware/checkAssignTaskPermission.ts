import { Request, Response, NextFunction } from "express";
import prisma from "../prisma/prismaClient";

export const checkAssignTaskPermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.body.userId;
    const { id_tache } = req.body;

    if (!id_tache) return res.status(400).json({ message: "id_tache requis" });

    const task = await prisma.tache.findUnique({ where: { id_tache } });
    if (!task) return res.status(404).json({ message: "Tâche inexistante" });

    const user = await prisma.utilisateur.findUnique({ where: { id_utilisateur: userId } });
    if (!user) return res.status(404).json({ message: "Utilisateur inexistant" });

    const chef = await prisma.affectation.findFirst({
      where: { id_projet: task.id_projet, role_affectation: "chef" }
    });

    if (!chef || chef.id_utilisateur !== userId) {
      return res.status(403).json({ message: "Seulement le chef de projet peut assigner" });
    }

    next();

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};