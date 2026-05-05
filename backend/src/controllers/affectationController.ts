import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";

export const assignChefProjet = async (req: Request, res: Response) => {
  try {
    const idProjet = parseInt(req.params.id as string);
    const { id_utilisateur } = req.body;

    const projet = await prisma.projet.findUnique({
      where: { id_projet: idProjet }
    });

    if (!projet) {
      return res.status(404).json({ message: "Projet inexistant" });
    }

    const existingChef = await prisma.affectation.findFirst({
      where: {
        id_projet: idProjet,
        role_affectation: "chef"
      }
    });

    if (existingChef) {
      return res.status(400).json({
        message: "Ce projet a déjà un chef de projet"
      });
    }

    const user = await prisma.utilisateur.findUnique({
      where: { id_utilisateur }
    });

    if (!user) {
      return res.status(404).json({ message: "Utilisateur inexistant" });
    }

    const affectation = await prisma.affectation.create({
      data: {
        id_projet: idProjet,
        id_utilisateur,
        role_affectation: "chef"
      }
    });

    res.json({
      message: "Chef de projet assigné",
      affectation
    });

  } 
  catch (error:any) {
     console.error(error);
    res.status(500).json({ error: error.message });
  }
};
export const assignMembersToProjet = async (req: Request, res: Response) => {
  try {
    const idProjet = parseInt(req.params.id as string);
    const { usersIds }: { usersIds: number[] } = req.body;

    const projet = await prisma.projet.findUnique({
      where: { id_projet: idProjet }
    });

    if (!projet) {
      return res.status(404).json({ message: "Projet inexistant" });
    }

    if (!usersIds || usersIds.length === 0) {
      return res.status(400).json({ message: "Aucun utilisateur fourni" });
    }

    const users = await prisma.utilisateur.findMany({
      where: {
        id_utilisateur: { in: usersIds }
      }
    });

    if (users.length !== usersIds.length) {
      return res.status(400).json({ message: "Certains utilisateurs n'existent pas" });
    }

    const existing = await prisma.affectation.findMany({
      where: {
        id_projet: idProjet,
        id_utilisateur: { in: usersIds }
      }
    });

    const existingIds = existing.map((a: any) => a.id_utilisateur);

    const newUsers = usersIds.filter(id => !existingIds.includes(id));

    const affectations = await prisma.affectation.createMany({
      data: newUsers.map(id => ({
        id_projet: idProjet,
        id_utilisateur: id,
        role_affectation: "membre"
      }))
    });

    res.json({
      message: "Membres assignés",
      count: affectations.count
    });

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
export const assignMembers = async (req: Request, res: Response) => {
  try {
    const { id_projet, membres } = req.body; 
    if (!id_projet || !Array.isArray(membres)) {
      return res.status(400).json({ error: "id_projet et membres requis" });
    }

    const affectations = [];

    for (const id_utilisateur of membres) {

        const userExist = await prisma.utilisateur.findUnique({
        where: { id_utilisateur },
      });
      if (!userExist) continue;

      const newAff = await prisma.affectation.create({
        data: {
          id_projet,
          id_utilisateur,
          role_affectation: "membre",
          statut: "active",
          date_affectation: new Date(),
        },
      });
      affectations.push(newAff);
    }

    res.status(201).json({
      message: "Membres assignés au projet",
      affectations,
    });

  } catch (error) {
    console.error("Erreur assignation membres :", error);
    res.status(500).json({ error: "Erreur assignation membres" });
  }
};
