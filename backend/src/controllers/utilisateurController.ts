import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";
import { hashPassword } from "../utils/hash";
import { MessagingService } from "../services/messaging.service";
import { computePresenceOnline, PRESENCE_MAX_IDLE_MS } from "../lib/presence";
import {
  utilisateurListCoreSelect,
  utilisateurPresenceSelect,
} from "../lib/utilisateurSelect";
import { createUtilisateurSafe } from "../lib/createUtilisateurSafe";

export const createUtilisateur = async (req: Request, res: Response) => {
  try {
    const { nom, prenom, email, password, id_role, poste, telephone, id_entreprise } = req.body;

    if (!email || !password || !id_role || !id_entreprise)
      return res.status(400).json({ error: "Champs obligatoires manquants" });

    const hashedPassword = await hashPassword(password);

    const utilisateur = await createUtilisateurSafe({
      nom,
      prenom,
      email,
      password: hashedPassword,
      id_role,
      id_entreprise,
      poste,
      telephone,
      statut: "ACTIVE",
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

    const { status, type } = req.query;

    if (user.role === "SuperAdmin" && type !== "all") {
      // SuperAdmin: Voir uniquement les administrateurs de la plateforme
      whereClause.role = {
        nom: { in: ["Admin", "ADMIN", "admin"] }
      };
    } else if (user.role !== "SuperAdmin") {
      // Admin entreprise: Voir tous les membres de son entreprise
      whereClause.id_entreprise = user.id_entreprise;
    }

    const baseWhere = { ...whereClause };

    let utilisateurs: any[];
    try {
      const whereWithPresence =
        status === "active"
          ? {
              ...baseWhere,
              isOnline: true,
              lastSeen: { gte: new Date(Date.now() - PRESENCE_MAX_IDLE_MS) },
            }
          : baseWhere;

      utilisateurs = await prisma.utilisateur.findMany({
        where: whereWithPresence,
        select: {
          ...utilisateurListCoreSelect,
          ...utilisateurPresenceSelect,
          adminOf: { select: { id_entreprise: true, nom: true } },
        },
        orderBy: { id_utilisateur: "desc" },
      });
    } catch (err) {
      console.warn("[utilisateurs] list with presence failed, using legacy query:", err);
      const whereLegacy =
        status === "active"
          ? {
              ...baseWhere,
              lastLogin: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            }
          : baseWhere;

      utilisateurs = await prisma.utilisateur.findMany({
        where: whereLegacy,
        select: utilisateurListCoreSelect,
        orderBy: { id_utilisateur: "desc" },
      });
    }

    if (user.role === "SuperAdmin") {
      console.log("Admins trouvés:", utilisateurs.length);
    }

    const userIds = utilisateurs
      .map((u) => u.id_utilisateur)
      .filter((id): id is number => typeof id === "number" && Number.isFinite(id) && id > 0);

    /** userId -> projets avec rôle dans le projet (`membre_projet` uniquement). */
    type ProjectWithRole = { id: number; name: string; roleProjet: string };
    const projectsByUserId = new Map<number, Map<number, ProjectWithRole>>();

    const projectName = (projet: { id_projet: number; nom_p: string | null } | null | undefined) =>
      (projet?.nom_p && projet.nom_p.trim()) || `Projet #${projet?.id_projet}`;

    const upsertProjectRole = (
      userId: number | null | undefined,
      projet: { id_projet: number; nom_p: string | null } | null | undefined,
      roleProjet: string
    ) => {
      if (userId == null || !projet?.id_projet) return;
      let map = projectsByUserId.get(userId);
      if (!map) {
        map = new Map();
        projectsByUserId.set(userId, map);
      }
      const pid = projet.id_projet;
      const name = projectName(projet);
      map.set(pid, { id: pid, name, roleProjet });
    };

    if (userIds.length > 0) {
      try {
        const membres = await prisma.membre_projet.findMany({
          where: { id_utilisateur: { in: userIds } },
          select: {
            id_utilisateur: true,
            role_projet: true,
            projet: { select: { id_projet: true, nom_p: true } },
          },
        });

        for (const m of membres) {
          const label = (m.role_projet && m.role_projet.trim()) || "Membre";
          upsertProjectRole(m.id_utilisateur, m.projet ?? undefined, label);
        }
      } catch (projErr) {
        console.warn("[utilisateurs] project aggregation failed (non-fatal):", projErr);
      }
    }

    const payload = utilisateurs.map((u) => {
      const uid = u.id_utilisateur;
      const map = typeof uid === "number" && uid > 0 ? projectsByUserId.get(uid) : undefined;
      const projects = map ? Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "fr")) : [];
      const adminOf = (u as { adminOf?: { id_entreprise: number; nom: string | null } | null }).adminOf;
      const entreprise =
        u.entreprise ??
        (adminOf ? { nom: adminOf.nom, id_entreprise: adminOf.id_entreprise } : null);
      const { adminOf: _adminOf, ...rest } = u as typeof u & {
        adminOf?: { id_entreprise: number; nom: string | null } | null;
      };
      return {
        ...rest,
        entreprise,
        isOnline: computePresenceOnline(!!u.isOnline, u.lastSeen ?? null),
        projects,
      };
    });

    res.json(payload);
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

    let utilisateur: any;
    try {
      utilisateur = await prisma.utilisateur.findUnique({
        where: { id_utilisateur: id },
        select: {
          ...utilisateurListCoreSelect,
          ...utilisateurPresenceSelect,
        },
      });
    } catch (err) {
      console.warn("[utilisateurs] getById with presence failed, retrying core:", err);
      utilisateur = await prisma.utilisateur.findUnique({
        where: { id_utilisateur: id },
        select: utilisateurListCoreSelect,
      });
    }

    if (!utilisateur) return res.status(404).json({ error: "Utilisateur non trouvé" });

    res.json({
      ...utilisateur,
      isOnline: computePresenceOnline(!!utilisateur.isOnline, utilisateur.lastSeen ?? null),
    });
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

    const data: Record<string, unknown> = {};
    if (nom !== undefined) data.nom = nom;
    if (prenom !== undefined) data.prenom = prenom;
    if (email !== undefined) data.email = email;
    if (id_role !== undefined) data.id_role = id_role;
    if (poste !== undefined) data.poste = poste;
    if (telephone !== undefined) data.telephone = telephone;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Aucun champ à mettre à jour" });
    }

    const utilisateur = await prisma.utilisateur.update({
      where: { id_utilisateur: id },
      data,
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