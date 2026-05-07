import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";
import { hashPassword } from "../utils/hash";
import { MessagingService } from "../services/messaging.service";

export const createUtilisateur = async (req: Request, res: Response) => {
  try {
    const { nom, prenom, email, password, id_role, poste, telephone, id_entreprise } = req.body;

    if (!email || !password || !id_role || !id_entreprise)
      return res.status(400).json({ error: "Champs obligatoires manquants" });

    const hashedPassword = await hashPassword(password);

    const utilisateur = await prisma.utilisateur.create({
      data: {
        nom,
        prenom,
        email,
        password: hashedPassword,
        id_role,
        id_entreprise,
        poste,
        telephone,
        statut: "ACTIVE" // Direct creation usually means active
      },
    });

    // Auto-add to Admin Meeting group if they are an Admin
    await MessagingService.addUserToAdminMeetingGroup(utilisateur.id_utilisateur);

    res.status(201).json({ message: "Utilisateur créé", utilisateur });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur création utilisateur" });
  }
};

export const getAllUtilisateurs = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let whereClause: any = {};

    const { status } = req.query;

    if (user.role === "SuperAdmin") {
      // SuperAdmin: Voir uniquement les administrateurs de la plateforme
      whereClause.role = {
        nom: { in: ["Admin", "ADMIN", "admin"] }
      };
    } else {
      // Admin entreprise: Voir tous les membres de son entreprise
      whereClause.id_entreprise = user.id_entreprise;
    }

    if (status === 'active') {

    }

    const utilisateurs = await prisma.utilisateur.findMany({
      where: whereClause,
      include: { role: true, entreprise: true },
      orderBy: { id_utilisateur: 'desc' }
    });

    if (user.role === "SuperAdmin") {
      console.log("Admins trouvés:", utilisateurs.length);
    }

    res.json(utilisateurs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur récupération utilisateurs" });
  }
};

export const getUtilisateurById = async (req: Request, res: Response) => {
  try {
    let idParam = req.params.id;
    if (Array.isArray(idParam)) idParam = idParam[0];
    const id = parseInt(idParam);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id_utilisateur: id },
      include: { role: true, entreprise: true },
    });

    if (!utilisateur) return res.status(404).json({ error: "Utilisateur non trouvé" });

    res.json(utilisateur);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur récupération utilisateur" });
  }
};

export const updateUtilisateur = async (req: Request, res: Response) => {
  try {
    let idParam = req.params.id;
    if (Array.isArray(idParam)) idParam = idParam[0];
    const id = parseInt(idParam);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    const { nom, prenom, email, id_role, poste, telephone } = req.body;

    const utilisateur = await prisma.utilisateur.update({
      where: { id_utilisateur: id },
      data: { nom, prenom, email, id_role, poste, telephone },
    });

    // Sync Admin Meeting group in case role changed
    await MessagingService.initAdminMeetingGroup();

    res.json({ message: "Utilisateur mis à jour", utilisateur });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur mise à jour utilisateur" });
  }
};

export const deleteUtilisateur = async (req: Request, res: Response) => {
  try {
    let idParam = req.params.id;
    if (Array.isArray(idParam)) idParam = idParam[0];
    const id = parseInt(idParam);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    await prisma.utilisateur.delete({ where: { id_utilisateur: id } });

    // Sync Admin Meeting group
    await MessagingService.initAdminMeetingGroup();

    res.json({ message: "Utilisateur supprimé" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur suppression utilisateur" });
  }
};