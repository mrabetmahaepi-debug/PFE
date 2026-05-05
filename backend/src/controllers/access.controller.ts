import { Request, Response, NextFunction } from "express";
import prisma from "../prisma/prismaClient";
import { successResponse } from "../utils/response";

// Get all Admins
export const getAdmins = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admins = await prisma.utilisateur.findMany({
      where: {
        role: {
          nom: {
            in: ["Admin", "ADMIN", "admin"]
          }
        }
      },
      include: {
        role: true,
        entreprise: true
      }
    });
    return successResponse(res, admins, "Liste des admins récupérée");
  } catch (error) {
    next(error);
  }
};

// Get all Projects
export const getProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await prisma.projet.findMany({
      include: {
        entreprise: true
      }
    });
    return successResponse(res, projects, "Liste des projets récupérée");
  } catch (error) {
    next(error);
  }
};

// Get access for a specific admin
export const getAdminAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const access = await prisma.membre_projet.findMany({
      where: { id_utilisateur: parseInt(id) },
      include: { projet: true }
    });
    return successResponse(res, access, "Accès de l'admin récupérés");
  } catch (error) {
    next(error);
  }
};

// Assign project to admin
export const assignProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id_utilisateur, id_projet } = req.body;
    
    // Check if already assigned
    const existing = await prisma.membre_projet.findFirst({
      where: {
        id_utilisateur: parseInt(id_utilisateur),
        id_projet: parseInt(id_projet)
      }
    });

    if (existing) {
      throw new Error("L'admin a déjà accès à ce projet");
    }

    const access = await prisma.membre_projet.create({
      data: {
        id_utilisateur: parseInt(id_utilisateur),
        id_projet: parseInt(id_projet)
      } as any
    });

    try {
      const u = await prisma.utilisateur.findUnique({ where: { id_utilisateur: parseInt(id_utilisateur) } });
      const p = await prisma.projet.findUnique({ where: { id_projet: parseInt(id_projet) } });
      await (prisma as any).activity.create({
        data: {
          user: u?.prenom ? `${u.prenom} ${u.nom}` : "Admin",
          action: "Accès projet accordé",
          entreprise: p?.nom_p || "Projet non spécifié",
          status: "ACTIVE",
          type: "project",
          entityId: parseInt(id_projet)
        }
      });
      console.log("Activity logged");
    } catch (e) { console.error("Activity logging error", e); }

    return successResponse(res, access, "Accès accordé avec succès", 201);
  } catch (error) {
    next(error);
  }
};

// Unassign project from admin
export const unassignProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id_utilisateur, id_projet } = req.query;
    
    if (!id_utilisateur || !id_projet) {
      throw new Error("id_utilisateur et id_projet sont requis");
    }

    await prisma.membre_projet.deleteMany({
      where: {
        id_utilisateur: parseInt(id_utilisateur as string),
        id_projet: parseInt(id_projet as string)
      }
    });

    try {
      const u = await prisma.utilisateur.findUnique({ where: { id_utilisateur: parseInt(id_utilisateur as string) } });
      const p = await prisma.projet.findUnique({ where: { id_projet: parseInt(id_projet as string) } });
      await (prisma as any).activity.create({
        data: {
          user: u?.prenom ? `${u.prenom} ${u.nom}` : "Admin",
          action: "Accès projet retiré",
          entreprise: p?.nom_p || "Projet non spécifié",
          status: "PENDING",
          type: "project",
          entityId: parseInt(id_projet as string)
        }
      });
      console.log("Activity logged");
    } catch (e) { console.error("Activity logging error", e); }

    return successResponse(res, null, "Accès retiré avec succès");
  } catch (error) {
    next(error);
  }
};
