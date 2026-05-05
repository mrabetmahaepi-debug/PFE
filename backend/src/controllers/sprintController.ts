import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";

export const createSprint = async (req: Request, res: Response) => {
  try {
    const { nom_s, date_debut_s, date_fin_s, statut_s, id_projet } = req.body;

    const sprint = await prisma.sprint.create({
      data: {
        nom_s,
        date_debut_s: date_debut_s ? new Date(date_debut_s) : null,
        date_fin_s: date_fin_s ? new Date(date_fin_s) : null,
        statut_s,
        id_projet,
      },
    });

    res.status(201).json(sprint);
  } catch (error) {
    console.error("Erreur création sprint :", error);
    res.status(500).json({ error: "Erreur création sprint" });
  }
};

export const getSprintsByProjet = async (req: Request, res: Response) => {
  try {
    let idParam = req.params.id_projet;
    if (Array.isArray(idParam)) idParam = idParam[0];
    const id_projet = parseInt(idParam);

    const sprints = await prisma.sprint.findMany({ where: { id_projet } });

    res.json(sprints);
  } catch (error) {
    console.error("Erreur récupération sprints :", error);
    res.status(500).json({ error: "Erreur récupération sprints" });
  }
};

export const getSprintById = async (req: Request, res: Response) => {
  try {
    let idParam = req.params.id_sprint;
    if (Array.isArray(idParam)) idParam = idParam[0];
    const id_sprint = parseInt(idParam);

    const sprint = await prisma.sprint.findUnique({ where: { id_sprint } });

    if (!sprint) {
      return res.status(404).json({ message: "Sprint inexistant" });
    }

    res.json(sprint);
  } catch (error) {
    console.error("Erreur récupération sprint :", error);
    res.status(500).json({ error: "Erreur récupération sprint" });
  }
};

export const updateSprint = async (req: Request, res: Response) => {
  try {
    let idParam = req.params.id_sprint;
    if (Array.isArray(idParam)) idParam = idParam[0];
    const id_sprint = parseInt(idParam);

    const { nom_s, date_debut_s, date_fin_s, statut_s } = req.body;

    const sprint = await prisma.sprint.update({
      where: { id_sprint },
      data: {
        nom_s,
        date_debut_s: date_debut_s ? new Date(date_debut_s) : null,
        date_fin_s: date_fin_s ? new Date(date_fin_s) : null,
        statut_s,
      },
    });

    res.json({ message: "Sprint mis à jour", sprint });
  } catch (error) {
    console.error("Erreur mise à jour sprint :", error);
    res.status(500).json({ error: "Erreur mise à jour sprint" });
  }
};

export const deleteSprint = async (req: Request, res: Response) => {
  try {
    let idParam = req.params.id_sprint;
    if (Array.isArray(idParam)) idParam = idParam[0];
    const id_sprint = parseInt(idParam);

    await prisma.sprint.delete({ where: { id_sprint } });

    res.json({ message: "Sprint supprimé" });
  } catch (error) {
    console.error("Erreur suppression sprint :", error);
    res.status(500).json({ error: "Erreur suppression sprint" });
  }
};