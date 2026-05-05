import { Request, Response, NextFunction } from "express";
import prisma from "../prisma/prismaClient";
import { successResponse } from "../utils/response";
import { paginate, paginatedResponse } from "../middleware/validate";
import { hashPassword } from "../utils/hash";
import { MessagingService } from "../services/messaging.service";

// --- Créer entreprise ---
export const createEntreprise = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nom, adresse } = req.body;

    const entreprise = await prisma.entreprise.create({
      data: { nom, adresse }
    });

    // Create notification for SuperAdmin
    const superAdmin = await prisma.utilisateur.findFirst({
      where: { role: { nom: "SuperAdmin" } }
    });

    if (superAdmin) {
      await prisma.notification.create({
        data: {
          sujet: "Nouvelle Entreprise",
          message: `L'entreprise "${nom}" a été créée avec succès.`,
          type: "success",
          id_utilisateur: superAdmin.id_utilisateur,
          date_envoi: new Date()
        }
      });
    }

    console.log("Entreprise créée dans la DB:", entreprise);

    try {
      await (prisma as any).activity.create({
        data: {
          user: "Super Admin",
          action: "Nouvelle entreprise créée",
          entreprise: nom,
          status: "ACTIVE",
          type: "enterprise",
          entityId: entreprise.id_entreprise
        }
      });
      console.log("Activity logged");
    } catch (e) { console.error("Logging error", e); }

    return successResponse(res, entreprise, "Entreprise créée", 201);
  } catch (error) {
    console.error("Erreur dans createEntreprise:", error);
    next(error);
  }
};

// --- Liste toutes les entreprises ---
export const getAllEntreprises = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req);

    const [entreprises, total] = await Promise.all([
      prisma.entreprise.findMany({
        skip,
        take: limit,
        orderBy: { id_entreprise: 'desc' }
      }),
      prisma.entreprise.count()
    ]);

    return successResponse(res, paginatedResponse(entreprises, total, page, limit), "Liste des entreprises");
  } catch (error) {
    next(error);
  }
};

// --- Obtenir une entreprise par ID ---
export const getEntrepriseById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const entreprise = await prisma.entreprise.findUnique({
      where: { id_entreprise: parseInt(id as string) }
    });

    if (!entreprise) {
      throw new Error("Entreprise inexistante");
    }

    return successResponse(res, entreprise, "Entreprise trouvée");
  } catch (error) {
    next(error);
  }
};

// --- Mettre à jour une entreprise ---
export const updateEntreprise = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { nom, adresse } = req.body;

    const entreprise = await prisma.entreprise.update({
      where: { id_entreprise: parseInt(id as string) },
      data: { nom, adresse }
    });

    return successResponse(res, entreprise, "Entreprise mise à jour");
  } catch (error) {
    next(error);
  }
};

// --- Supprimer une entreprise ---
export const deleteEntreprise = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.entreprise.delete({
      where: { id_entreprise: parseInt(id as string) }
    });

    return successResponse(res, null, "Entreprise supprimée");
  } catch (error) {
    next(error);
  }
};

export const inviteAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id_entreprise, email, nom, prenom, mot_de_passe } = req.body;
    
    console.log(`[InviteAdmin] Tentative d'invitation pour ${email} dans l'entreprise ${id_entreprise}`);

    // 1. Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.utilisateur.findUnique({
      where: { email }
    });
    if (existingUser) {
      console.log(`[InviteAdmin] Échec: L'email ${email} est déjà utilisé.`);
      return res.status(400).json({ message: "Un utilisateur avec cet email existe déjà." });
    }

    // 2. Trouver le rôle Admin (priorité à celui de l'entreprise)
    let adminRole = await prisma.role.findFirst({
      where: { 
        nom: { in: ["Admin", "ADMIN", "admin"] },
        id_entreprise: parseInt(id_entreprise as string)
      }
    });

    if (!adminRole) {
      console.log(`[InviteAdmin] Rôle Admin non trouvé pour l'entreprise ${id_entreprise}. Recherche d'un rôle global...`);
      adminRole = await prisma.role.findFirst({
        where: { nom: { in: ["Admin", "ADMIN", "admin"] } }
      });
    }

    if (!adminRole) {
      console.log(`[InviteAdmin] Échec: Rôle 'Admin' introuvable dans le système.`);
      return res.status(500).json({ message: "Le rôle 'Admin' n'existe pas dans le système. Veuillez le créer pour cette entreprise." });
    }

    // 3. Hasher le mot de passe
    const hashedPassword = await hashPassword(mot_de_passe);

    // 4. Créer l'utilisateur
    const user = await prisma.utilisateur.create({
      data: {
        nom,
        prenom,
        email,
        password: hashedPassword,
        id_role: adminRole.id_role,
        id_entreprise: parseInt(id_entreprise as string),
        statut: "ACTIVE"
      },
      include: { role: true }
    });

    console.log(`[InviteAdmin] Utilisateur créé avec succès (ID: ${user.id_utilisateur})`);

    // 5. Mettre à jour l'entreprise avec cet admin si elle n'en a pas
    const entreprise = await prisma.entreprise.findUnique({
      where: { id_entreprise: parseInt(id_entreprise as string) }
    });
    if (entreprise && !entreprise.admin_id) {
      await prisma.entreprise.update({
        where: { id_entreprise: entreprise.id_entreprise },
        data: { admin_id: user.id_utilisateur }
      });
      console.log(`[InviteAdmin] Entreprise ${id_entreprise} liée à l'admin ${user.id_utilisateur}`);
    }

    // 6. Ajouter au groupe "Réunion Admins"
    let groupWarning = "";
    try {
      await MessagingService.addUserToAdminMeetingGroup(user.id_utilisateur);
      console.log(`[InviteAdmin] Utilisateur ajouté au groupe Réunion Admins`);
    } catch (groupError: any) {
      console.error("[InviteAdmin] Erreur lors de l'ajout au groupe Réunion Admins:", groupError.message);
      groupWarning = " (Note: échec de l'ajout au groupe Réunion Admins)";
    }

    try {
      await (prisma as any).activity.create({
        data: {
          user: `${prenom} ${nom}`,
          action: "Admin invité et créé",
          entreprise: entreprise?.nom || "Non spécifiée",
          status: "ACTIVE",
          type: "user",
          entityId: user.id_utilisateur
        }
      });
      console.log("Activity logged");
    } catch (e) { console.error("Logging error", e); }

    return successResponse(res, user, `Administrateur invité et créé avec succès${groupWarning}`, 201);
  } catch (error: any) {
    console.error("[InviteAdmin] Erreur fatale:", error);
    res.status(500).json({ 
      message: "Échec de l'invitation", 
      error: error.message,
      details: "Une erreur interne est survenue lors de la création de l'administrateur."
    });
  }
};

// --- Activer / Désactiver une entreprise ---
export const toggleEntrepriseStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const existing = await prisma.entreprise.findUnique({
      where: { id_entreprise: parseInt(id as string) }
    });

    if (!existing) {
      throw new Error("Entreprise inexistante");
    }

    const newStatus = existing.statut === "active" ? "inactive" : "active";

    const entreprise = await prisma.entreprise.update({
      where: { id_entreprise: parseInt(id as string) },
      data: { statut: newStatus }
    });

    return successResponse(res, entreprise, `Entreprise ${newStatus === "active" ? "activée" : "désactivée"} avec succès`);
  } catch (error) {
    next(error);
  }
};