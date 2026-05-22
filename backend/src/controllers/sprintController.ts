import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";

const db = prisma as any;

const toNullableInt = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const validateSprintAncestors = async (
  id_projet: number,
  id_group?: number | null,
  id_folder?: number | null
) => {
  if (id_group) {
    const group = await db.group_pm.findUnique({ where: { id_group } });
    if (!group || group.id_projet !== id_projet) {
      throw new Error("Le groupe n'appartient pas à ce projet");
    }
  }

  if (id_folder) {
    const folder = await db.folder_pm.findUnique({ where: { id_folder } });
    if (!folder || folder.id_projet !== id_projet) {
      throw new Error("Le dossier n'appartient pas à ce projet");
    }
    if (id_group && folder.id_group && folder.id_group !== id_group) {
      throw new Error("Le dossier n'appartient pas à ce groupe");
    }
  }
};

export const createSprint = async (req: Request, res: Response) => {
  try {
    const { nom_s, date_debut_s, date_fin_s, statut_s, id_projet } = req.body;
    if (!id_projet) {
      return res.status(400).json({ error: "id_projet requis" });
    }

    const sprint = await prisma.sprint.create({
      data: {
        nom_s,
        date_debut_s: date_debut_s ? new Date(date_debut_s) : null,
        date_fin_s: date_fin_s ? new Date(date_fin_s) : null,
        statut_s,
        id_projet: Number(id_projet),
      },
    });

    res.status(201).json(sprint);
  } catch (error) {
    console.error("Erreur création sprint :", error);
    res.status(500).json({ error: (error as Error).message || "Erreur création sprint" });
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

    const existing = await prisma.sprint.findUnique({ where: { id_sprint } });
    if (!existing) {
      return res.status(404).json({ message: "Sprint inexistant" });
    }

    const { nom_s, date_debut_s, date_fin_s, statut_s } = req.body;
    const id_group =
      req.body.id_group !== undefined
        ? toNullableInt(req.body.id_group)
        : (existing as any).id_group;
    const id_folder =
      req.body.id_folder !== undefined
        ? toNullableInt(req.body.id_folder)
        : (existing as any).id_folder;

    if (existing.id_projet) {
      await validateSprintAncestors(existing.id_projet, id_group, id_folder);
    }

    const sprint = await prisma.sprint.update({
      where: { id_sprint },
      data: {
        nom_s,
        date_debut_s: date_debut_s ? new Date(date_debut_s) : null,
        date_fin_s: date_fin_s ? new Date(date_fin_s) : null,
        statut_s,
        id_group: req.body.id_group !== undefined ? id_group : undefined,
        id_folder: req.body.id_folder !== undefined ? id_folder : undefined,
      },
    });

    res.json({ message: "Sprint mis à jour", sprint });
  } catch (error) {
    console.error("Erreur mise à jour sprint :", error);
    res.status(500).json({ error: (error as Error).message || "Erreur mise à jour sprint" });
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