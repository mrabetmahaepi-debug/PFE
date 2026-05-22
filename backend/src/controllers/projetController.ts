import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../prisma/prismaClient";
import { isSuperAdmin, userHasPermission } from "../middleware/permissions";
import {
  utilisateurListCoreSelect,
  utilisateurPublicChefSelect,
} from "../lib/utilisateurSelect";
import {
  isGlobalMembreUser,
  isTenantAdminUser,
  PROJECT_READ_FORBIDDEN_MESSAGE,
  userCanReadProject,
} from "../lib/projectAccess";
import {
  assertProjectPermission,
  getProjectPermissionContext,
  hasProjectPermission,
  serializeWorkspaceProjectAuth,
} from "../services/projectPermission.service";
import { ensureMonEspace } from "../lib/spaceHierarchy";

const CHEF_DE_PROJET_ROLE_LABEL = "Chef de Projet";

function parseOptionalDate(input: unknown): Date | null {
  if (input === undefined || input === null || input === "") return null;
  const d = new Date(input as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Accepte les champs historiques (nom_p, date_debut…) et les alias API (name, startDate…). */
function normalizeCreateProjectInput(body: any) {
  const nom_p = body?.nom_p ?? body?.name;
  const description_p = body?.description_p ?? body?.description ?? "";
  const date_debut = body?.date_debut ?? body?.startDate;
  const date_fin = body?.date_fin ?? body?.endDate;
  const statut_p = body?.statut_p ?? body?.status ?? "PLANNING";
  return { nom_p, description_p, date_debut, date_fin, statut_p };
}

function parsePositiveInt(input: unknown): number | null {
  if (input === undefined || input === null || input === "") return null;
  const n = Number(input);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

async function resolveDefaultSpaceId(entId: number): Promise<number | null> {
  return ensureMonEspace(entId);
}

function parseProjectMembersPayload(body: any): { userId: number; projectRole: string }[] {
  const raw = body?.members;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: { userId: number; projectRole: string }[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const uid = parsePositiveInt(
      (m as any).userId ?? (m as any).user_id ?? (m as any).user
    );
    if (uid == null) continue;
    if (seen.has(uid)) continue;
    seen.add(uid);
    let role = String(
      (m as any).roleProjet ?? (m as any).role_projet ?? (m as any).role ?? (m as any).projectRole ?? "Autre"
    ).trim();
    if (!role) role = "Autre";
    if (role.length > 120) role = role.slice(0, 120);
    out.push({ userId: uid, projectRole: role });
  }
  return out;
}

async function upsertMembreProjetRow(
  tx: Prisma.TransactionClient,
  projetId: number,
  userId: number,
  roleLabel: string | null
) {
  const existing = await tx.membre_projet.findFirst({
    where: { id_projet: projetId, id_utilisateur: userId },
  });
  if (existing) {
    await tx.membre_projet.update({
      where: { id_membre_projet: existing.id_membre_projet },
      data: { role_projet: roleLabel },
    });
  } else {
    await tx.membre_projet.create({
      data: {
        id_projet: projetId,
        id_utilisateur: userId,
        role_projet: roleLabel,
      },
    });
  }
}

async function ensureProjectAffectationTx(
  tx: Prisma.TransactionClient,
  projetId: number,
  userId: number,
  role: "chef" | "membre"
) {
  const existing = await tx.affectation.findFirst({
    where: { id_projet: projetId, id_utilisateur: userId, id_tache: null },
  });
  if (!existing) {
    await tx.affectation.create({
      data: {
        id_projet: projetId,
        id_utilisateur: userId,
        role_affectation: role,
      },
    });
    return;
  }
  if (role === "chef") {
    await tx.affectation.update({
      where: { id_affectation: existing.id_affectation },
      data: { role_affectation: "chef" },
    });
  } else if (existing.role_affectation !== "chef") {
    await tx.affectation.update({
      where: { id_affectation: existing.id_affectation },
      data: { role_affectation: "membre" },
    });
  }
}

export const createProjet = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { nom_p, description_p, date_debut, date_fin, statut_p } = normalizeCreateProjectInput(req.body);

    if (!nom_p || typeof nom_p !== "string" || !nom_p.trim()) {
      return res.status(400).json({ message: "Le nom du projet est obligatoire." });
    }

    const logActivity = async (projetId: number) => {
      try {
        const ent = await prisma.entreprise.findUnique({
          where: { id_entreprise: user.id_entreprise || 0 },
        });
        await (prisma as any).activity.create({
          data: {
            user: user.prenom ? `${user.prenom} ${user.nom}` : "Système",
            action: "Nouveau projet créé",
            entreprise: ent?.nom || "Non spécifiée",
            status: "ACTIVE",
            type: "project",
            entityId: projetId,
          },
        });
      } catch (e) {
        console.error("Activity logging error", e);
      }
    };

    const bodySpaceId = parsePositiveInt(req.body.id_space ?? req.body.spaceId);

    // SuperAdmin: création minimale (pas d'équipe projet ici)
    if (isSuperAdmin(user)) {
      const entId = user.id_entreprise;
      const id_space =
        bodySpaceId ??
        (entId != null ? await resolveDefaultSpaceId(entId) : null);
      const projet = await prisma.projet.create({
        data: {
          nom_p: nom_p.trim(),
          description_p: description_p || null,
          date_debut: parseOptionalDate(date_debut),
          date_fin: parseOptionalDate(date_fin),
          statut_p: statut_p || "PLANNING",
          id_entreprise: entId,
          id_space,
        },
      });
      await logActivity(projet.id_projet);
      return res.status(201).json(projet);
    }

    const entId = user.id_entreprise;
    if (entId == null || entId === undefined) {
      return res.status(400).json({ message: "Entreprise introuvable pour cet utilisateur." });
    }

    let chefId =
      parsePositiveInt(req.body.projectManagerId) ??
      parsePositiveInt(req.body.chefDeProjetId) ??
      parsePositiveInt(req.body.chef_de_projet_id) ??
      parsePositiveInt(req.body.projectManager) ??
      parsePositiveInt(user.id);

    if (chefId == null) {
      return res.status(400).json({ message: "Chef de projet requis." });
    }

    const membersPayload = parseProjectMembersPayload(req.body).filter((m) => m.userId !== chefId);

    const allUserIds = [chefId, ...membersPayload.map((m) => m.userId)];
    const uniqueIds = [...new Set(allUserIds)];

    const teamUsers = await prisma.utilisateur.findMany({
      where: { id_utilisateur: { in: uniqueIds } },
      select: { id_utilisateur: true, id_entreprise: true },
    });
    if (teamUsers.length !== uniqueIds.length) {
      return res.status(400).json({ message: "Membre invalide : un ou plusieurs utilisateurs sont introuvables." });
    }
    for (const u of teamUsers) {
      if (u.id_entreprise !== entId) {
        return res.status(400).json({
          message: "Utilisateur non autorisé pour cette équipe.",
        });
      }
    }

    const id_space = bodySpaceId ?? (await resolveDefaultSpaceId(entId));

    const projet = await prisma.$transaction(async (tx) => {
      const p = await tx.projet.create({
        data: {
          nom_p: nom_p.trim(),
          description_p: description_p || null,
          date_debut: parseOptionalDate(date_debut) ?? new Date(),
          date_fin: parseOptionalDate(date_fin) ?? new Date(),
          statut_p: statut_p || "PLANNING",
          id_entreprise: entId,
          id_space,
          chef_de_projet_id: chefId,
        },
      });

      const ensureProjectAffectation = async (userId: number, role: "chef" | "membre") => {
        await ensureProjectAffectationTx(tx, p.id_projet, userId, role);
      };

      await ensureProjectAffectation(chefId, "chef");
      await upsertMembreProjetRow(tx, p.id_projet, chefId, CHEF_DE_PROJET_ROLE_LABEL);

      for (const m of membersPayload) {
        await ensureProjectAffectation(m.userId, "membre");
        await upsertMembreProjetRow(tx, p.id_projet, m.userId, m.projectRole);
      }

      return p;
    });

    await logActivity(projet.id_projet);
    res.status(201).json(projet);
  } catch (error) {
    console.error("createProjet error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return res.status(400).json({
          message: "Données invalides : référence utilisateur ou entreprise incorrecte.",
          code: error.code,
        });
      }
      if (error.code === "P2022") {
        return res.status(503).json({
          message:
            "La base de données n'est pas à jour : colonne manquante (ex. role_projet). Exécutez les migrations Prisma (npx prisma migrate deploy) puis réessayez.",
          code: error.code,
        });
      }
      return res.status(400).json({
        message: error.message || "Erreur lors de la création du projet.",
        code: error.code,
      });
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return res.status(400).json({
        message: "Données de projet invalides.",
      });
    }

    const rawMsg = error instanceof Error ? error.message : String(error);
    if (/unknown column.*role_projet|role_projet.*unknown column/i.test(rawMsg)) {
      return res.status(503).json({
        message:
          "La base de données n'est pas à jour : colonne role_projet absente sur membre_projet. Exécutez : npx prisma migrate deploy (dossier backend), puis redémarrez le serveur.",
      });
    }

    const message =
      error instanceof Error ? error.message : "Erreur lors de la création du projet.";
    return res.status(500).json({ message, error: "Erreur création projet" });
  }
};

/** Liste des utilisateurs de l'entreprise pour le picker « Équipe du projet » (chef de projet autorisé). */
export const getProjectTeamCandidates = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const user = (req as any).user;
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ message: "ID projet invalide." });
    }

    const permCtx = await getProjectPermissionContext(user, id);
    const canManageTeam =
      permCtx.fullAccess || hasProjectPermission(permCtx, "manage_project_members");
    if (!canManageTeam) {
      const projetChef = await prisma.projet.findUnique({
        where: { id_projet: id },
        select: { chef_de_projet_id: true },
      });
      if (projetChef?.chef_de_projet_id !== user?.id) {
        return res.status(403).json({
          message: "Permission refusée : gestion de l'équipe non autorisée",
          code: "PROJECT_PERMISSION_DENIED",
          requiredPermission: "manage_project_members",
        });
      }
    }

    const projet = await prisma.projet.findUnique({
      where: { id_projet: id },
      select: { id_entreprise: true },
    });
    if (!projet?.id_entreprise) {
      return res.status(404).json({ message: "Projet inexistant" });
    }

    const utilisateurs = await prisma.utilisateur.findMany({
      where: {
        id_entreprise: projet.id_entreprise,
        OR: [
          { role: null },
          {
            role: {
              nom: { notIn: ["SuperAdmin", "SUPERADMIN", "superadmin"] },
            },
          },
        ],
      },
      select: utilisateurListCoreSelect,
      orderBy: [{ prenom: "asc" }, { nom: "asc" }],
    });

    res.json(utilisateurs);
  } catch (error) {
    console.error("[getProjectTeamCandidates] error:", error);
    res.status(500).json({
      message: "Erreur lors du chargement des membres disponibles",
    });
  }
};

/**
 * Remplace l'équipe projet (`membre_projet` + chef) pour un projet existant.
 * N'altère pas les comptes globaux ni l'authentification.
 */
export const replaceProjetTeam = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const user = (req as any).user;
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ message: "ID projet invalide." });
    }
    const permCtx = await getProjectPermissionContext(user, id);
    const canManageTeam =
      permCtx.fullAccess || hasProjectPermission(permCtx, "manage_project_members");
    if (!canManageTeam) {
      const projetChef = await prisma.projet.findUnique({
        where: { id_projet: id },
        select: { chef_de_projet_id: true },
      });
      if (projetChef?.chef_de_projet_id !== user?.id) {
        return res.status(403).json({
          message: "Permission refusée : gestion de l'équipe non autorisée",
          code: "PROJECT_PERMISSION_DENIED",
          requiredPermission: "manage_project_members",
        });
      }
    }

    const chefId =
      parsePositiveInt(req.body.projectManagerId) ??
      parsePositiveInt(req.body.chefDeProjetId) ??
      parsePositiveInt(req.body.chef_de_projet_id) ??
      parsePositiveInt(req.body.chefId);
    if (chefId == null) {
      return res.status(400).json({ message: "Chef de projet requis." });
    }

    const membersPayload = parseProjectMembersPayload(req.body).filter(
      (m) => m.userId !== chefId
    );

    const projetRow = await prisma.projet.findUnique({
      where: { id_projet: id },
      select: { id_entreprise: true },
    });
    if (!projetRow?.id_entreprise) {
      return res.status(404).json({ message: "Projet inexistant" });
    }
    const entId = projetRow.id_entreprise;

    const allIds = [chefId, ...membersPayload.map((m) => m.userId)];
    const uniqueIds = [...new Set(allIds)];

    const teamUsers = await prisma.utilisateur.findMany({
      where: { id_utilisateur: { in: uniqueIds } },
      select: { id_utilisateur: true, id_entreprise: true },
    });
    if (teamUsers.length !== uniqueIds.length) {
      return res.status(400).json({
        message: "Membre invalide : un ou plusieurs utilisateurs sont introuvables.",
      });
    }
    for (const u of teamUsers) {
      if (u.id_entreprise !== entId) {
        return res.status(400).json({
          message: "Utilisateur non autorisé pour cette équipe.",
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.projet.update({
        where: { id_projet: id },
        data: { chef_de_projet_id: chefId },
      });

      await tx.membre_projet.deleteMany({
        where: { id_projet: id, id_utilisateur: { notIn: uniqueIds } },
      });
      await tx.affectation.deleteMany({
        where: {
          id_projet: id,
          id_tache: null,
          id_utilisateur: { notIn: uniqueIds },
        },
      });

      await ensureProjectAffectationTx(tx, id, chefId, "chef");
      await upsertMembreProjetRow(tx, id, chefId, CHEF_DE_PROJET_ROLE_LABEL);

      for (const m of membersPayload) {
        await ensureProjectAffectationTx(tx, id, m.userId, "membre");
        await upsertMembreProjetRow(tx, id, m.userId, m.projectRole);
      }
    });

    res.json({ message: "Équipe du projet mise à jour", id_projet: id });
  } catch (error) {
    console.error("replaceProjetTeam error:", error);
    res.status(500).json({
      message:
        error instanceof Error ? error.message : "Erreur mise à jour de l'équipe",
    });
  }
};

export const getAllProjets = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let whereClause: Record<string, unknown> = {};

    if (isSuperAdmin(user)) {
      // Plateforme : tous les projets (comportement existant).
      whereClause = {};
    } else {
      const entId = user?.id_entreprise;
      if (entId == null || entId === undefined) {
        return res.json([]);
      }
      whereClause.id_entreprise = entId;

      if (isGlobalMembreUser(user)) {
        whereClause.membre_projet = {
          some: { id_utilisateur: user.id },
        };
      } else if (!isTenantAdminUser(user)) {
        const canViewAllInEnterprise = await userHasPermission(
          req,
          "PROJECT_VIEW_ALL"
        );
        if (!canViewAllInEnterprise) {
          whereClause.membre_projet = {
            some: { id_utilisateur: user.id },
          };
        }
      }
      // Admin entreprise : filtre id_entreprise seul → tous les projets du tenant.
    }

    const projets = await prisma.projet.findMany({
      where: whereClause,
      include: {
        entreprise: {
          select: {
            id_entreprise: true,
            nom: true,
            adresse: true,
            statut: true,
            admin_id: true,
            admin: { select: utilisateurPublicChefSelect },
          },
        },
        chef_de_projet: {
          select: utilisateurPublicChefSelect,
        },
        affectation: {
          where: {
            id_tache: null,
            role_affectation: { in: ["chef", "membre"] },
          },
          include: {
            utilisateur: {
              select: utilisateurPublicChefSelect,
            },
          },
        },
        _count: {
          select: { tache: true, membre_projet: true },
        },
        tache: {
          select: { statut_t: true },
        },
      },
      orderBy: { id_projet: "desc" },
    });

    const projetsWithProgress = projets.map(p => {
      const totalTasks = p.tache.length;
      const completedTasks = p.tache.filter(t => {
        const s = t.statut_t?.toLowerCase();
        return s === 'done' || s === 'terminé' || s === 'terminée' || s === 'terminee';
      }).length;
      const avancement = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      const { tache, _count, entreprise, affectation, chef_de_projet, ...rest } = p;
      const affProject = (affectation ?? []).filter(
        (a: { id_tache: number | null; role_affectation: string | null }) =>
          a.id_tache == null && (a.role_affectation === "chef" || a.role_affectation === "membre")
      );
      const chefRow = affProject.find((a: { role_affectation: string | null }) => a.role_affectation === "chef");
      const chefFromAffectation = chefRow?.utilisateur;
      const chefFromFk = chef_de_projet as (typeof chefFromAffectation) | null | undefined;
      const chef = chefFromFk ?? chefFromAffectation;
      const admin = entreprise?.admin;
      const finalResponsable = chef 
        ? `${chef.prenom || ''} ${chef.nom || ''}`.trim() || chef.email
        : admin 
          ? `${admin.prenom || ''} ${admin.nom || ''}`.trim() || admin.email
          : 'Non assigné';

      return { 
        ...rest, 
        entreprise,
        totalTasks, 
        completedTasks, 
        avancement,
        responsable: finalResponsable,
        responsable_role: chef ? CHEF_DE_PROJET_ROLE_LABEL : admin ? "Admin" : null,
        chef_id: chef ? chef.id_utilisateur : null,
        chef_de_projet_id: p.chef_de_projet_id ?? (chef ? chef.id_utilisateur : null),
        projectManagerId: p.chef_de_projet_id ?? (chef ? chef.id_utilisateur : null),
        membresCount: new Set(
          affProject.map((a: { id_utilisateur: number | null }) => a.id_utilisateur).filter(
            (id): id is number => typeof id === "number" && id > 0
          )
        ).size,
        tachesCount: _count?.tache || 0,
      };
    });

    res.json(projetsWithProgress);

  } catch (error) {
    console.error("[getAllProjets] error:", error);
    res.status(500).json({
      error: "Erreur récupération projets",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};



export const getProjetById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const user = (req as any).user;

    const projet = await prisma.projet.findUnique({
      where: { id_projet: id },
      include: {
        entreprise: {
          select: { id_entreprise: true, nom: true },
        },
        chef_de_projet: {
          select: utilisateurPublicChefSelect,
        },
        affectation: {
          include: {
            utilisateur: {
              select: utilisateurPublicChefSelect,
            },
          },
        },
        membre_projet: {
          include: {
            utilisateur: {
              select: utilisateurPublicChefSelect,
            },
          },
        },
      },
    });

    if (!projet) {
      return res.status(404).json({ message: "Projet inexistant" });
    }

    const gatePayload = {
      id_entreprise: projet.id_entreprise,
      membre_projet: projet.membre_projet,
    };
    if (!userCanReadProject(user, gatePayload)) {
      return res.status(403).json({ message: PROJECT_READ_FORBIDDEN_MESSAGE });
    }

    // Compute stats
    const totalTasks = await prisma.tache.count({ where: { id_projet: id } });
    const completedTasks = await prisma.tache.count({
      where: {
        id_projet: id,
        statut_t: { in: ['terminee', 'done', 'terminé', 'terminée'] }
      }
    });
    const avancement = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    const chef =
      projet.chef_de_projet ??
      projet.affectation.find((a) => a.role_affectation === "chef")?.utilisateur;
    let finalResponsable: string = "Non assigné";
    if (chef) {
      finalResponsable =
        `${chef.prenom || ""} ${chef.nom || ""}`.trim() || chef.email || "Non assigné";
    } else {
      const entreprise = await prisma.entreprise.findUnique({
        where: { id_entreprise: projet.id_entreprise || 0 },
        select: {
          id_entreprise: true,
          nom: true,
          admin: { select: utilisateurPublicChefSelect },
        },
      });
      if (entreprise?.admin) {
        finalResponsable =
          `${entreprise.admin.prenom || ""} ${entreprise.admin.nom || ""}`.trim() ||
          entreprise.admin.email ||
          "Non assigné";
      }
    }

    const projectTeam = (projet.membre_projet || [])
      .filter((m) => m.id_utilisateur && m.utilisateur)
      .map((m) => {
        const u = m.utilisateur!;
        return {
          userId: m.id_utilisateur,
          email: u.email ?? "",
          prenom: u.prenom ?? "",
          nom: u.nom ?? "",
          roleProjet: m.role_projet?.trim() || "Membre",
        };
      })
      .sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"));

    const permCtx = await getProjectPermissionContext(user, id);
    if (!permCtx.fullAccess && !hasProjectPermission(permCtx, "view_project")) {
      return res.status(403).json({ message: PROJECT_READ_FORBIDDEN_MESSAGE });
    }

    const authPayload = serializeWorkspaceProjectAuth(user, permCtx);
    res.json({
      ...projet,
      avancement,
      totalTasks,
      completedTasks,
      responsable: finalResponsable,
      responsable_role: chef ? CHEF_DE_PROJET_ROLE_LABEL : "Non assigné",
      chef_id: chef ? chef.id_utilisateur : null,
      chef_de_projet_id: projet.chef_de_projet_id ?? (chef ? chef.id_utilisateur : null),
      projectManagerId: projet.chef_de_projet_id ?? (chef ? chef.id_utilisateur : null),
      projectTeam,
      currentUserProjectRole: authPayload.currentUserProjectRole,
      currentUserPermissions: authPayload.currentUserPermissions,
    });

  } catch (error) {
    console.error("[getProjetById] error:", error);
    res.status(500).json({
      error: "Erreur récupération projet",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};



export const updateProjet = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const user = (req as any).user;
    const permCtx = await getProjectPermissionContext(user, id);
    try {
      assertProjectPermission(permCtx, "edit_project");
    } catch (e: any) {
      return res.status(e?.status ?? 403).json({
        message: e?.message || "Permission refusée",
        code: e?.code ?? "PROJECT_PERMISSION_DENIED",
        requiredPermission: e?.requiredPermission,
      });
    }

    const { nom_p, description_p, date_debut, date_fin, statut_p } = req.body;

    const projet = await prisma.projet.update({
      where: { id_projet: id },
      data: {
        nom_p,
        description_p,
        date_debut: date_debut ? new Date(date_debut) : null,
        date_fin: date_fin ? new Date(date_fin) : null,
        statut_p
      }
    });

    res.json({
      message: "Projet mis à jour",
      projet
    });

  } catch (error) {
    res.status(500).json({ error: "Erreur mise à jour projet" });
  }
};



export const trashProjet = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const user = (req as any).user;
    const permCtx = await getProjectPermissionContext(user, id);
    try {
      assertProjectPermission(permCtx, "delete_project");
    } catch (e: any) {
      return res.status(e?.status ?? 403).json({
        message: e?.message || "Permission refusée",
      });
    }
    const { moveProjectToTrash } = await import("../lib/spaceHierarchy");
    await moveProjectToTrash(id);
    res.json({ message: "Dossier déplacé vers la corbeille" });
  } catch (error) {
    res.status(500).json({ error: "Erreur corbeille dossier" });
  }
};

export const restoreProjet = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const user = (req as any).user;
    const permCtx = await getProjectPermissionContext(user, id);
    try {
      assertProjectPermission(permCtx, "edit_project");
    } catch (e: any) {
      return res.status(e?.status ?? 403).json({
        message: e?.message || "Permission refusée",
      });
    }
    const { restoreProjectFromTrash } = await import("../lib/spaceHierarchy");
    await restoreProjectFromTrash(id);
    res.json({ message: "Dossier restauré" });
  } catch (error) {
    res.status(500).json({ error: "Erreur restauration dossier" });
  }
};

export const deleteProjet = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const user = (req as any).user;
    const permCtx = await getProjectPermissionContext(user, id);
    try {
      assertProjectPermission(permCtx, "delete_project");
    } catch (e: any) {
      return res.status(e?.status ?? 403).json({
        message: e?.message || "Permission refusée",
        code: e?.code ?? "PROJECT_PERMISSION_DENIED",
        requiredPermission: e?.requiredPermission,
      });
    }

    await prisma.projet.delete({
      where: { id_projet: id }
    });

    res.json({ message: "Projet supprimé" });

  } catch (error) {
    res.status(500).json({ error: "Erreur suppression projet" });
  }
};

export const getProjectTree = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "ID projet invalide" });
    }

    const user = (req as any).user;
    const project = await prisma.projet.findUnique({
      where: { id_projet: id },
      include: {
        entreprise: {
          select: {
            id_entreprise: true,
            nom: true,
            adresse: true,
            statut: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Projet introuvable" });
    }

    const gate = await prisma.projet.findUnique({
      where: { id_projet: id },
      select: {
        id_entreprise: true,
        membre_projet: { select: { id_utilisateur: true } },
      },
    });
    if (!gate) {
      return res.status(404).json({ message: "Projet introuvable" });
    }
    if (!userCanReadProject(user, gate)) {
      return res.status(403).json({ message: PROJECT_READ_FORBIDDEN_MESSAGE });
    }

    const treePermCtx = await getProjectPermissionContext(user, id);

    const db = prisma as any;
    const [sprintsFlat, listsFlat, tasks] = await Promise.all([
      prisma.sprint.findMany({
        where: { id_projet: id },
        orderBy: [{ id_sprint: "asc" }],
      }),
      db.list_pm.findMany({
        where: { id_projet: id },
        orderBy: [{ position: "asc" }, { id_list: "asc" }],
      }),
      prisma.tache.findMany({
        where: { id_projet: id },
        include: {
          utilisateur: {
            select: {
              id_utilisateur: true,
              nom: true,
              prenom: true,
              email: true,
            },
          },
        },
        orderBy: [{ id_tache: "asc" }],
      }),
    ]);

    const countTasksFor = (filter: (t: any) => boolean) =>
      (tasks as any[]).filter(filter).length;

    const buildList = (l: any) => {
      const listTasks = (tasks as any[]).filter(
        (t) => Number(t.id_list) === Number(l.id_list)
      );
      return {
        id_list: l.id_list,
        nom: l.nom,
        description: l.description ?? null,
        position: l.position ?? 0,
        id_projet: l.id_projet,
        id_sprint: l.id_sprint ?? null,
        task_count: listTasks.length,
        tasks: listTasks.map((t: any) => ({
          id_tache: t.id_tache,
          nom_t: t.nom_t ?? "Tâche",
          statut_t: t.statut_t ?? null,
          id_list: t.id_list ?? l.id_list,
          id_projet: t.id_projet ?? l.id_projet,
          id_sprint: t.id_sprint ?? null,
          priorite_t: t.priorite_t ?? null,
          date_limite_t: t.date_limite_t ?? null,
        })),
      };
    };

    const buildSprint = (s: any) => {
      const sprintLists = (listsFlat as any[]).filter(
        (l) => l.id_sprint === s.id_sprint
      );
      return {
        id_sprint: s.id_sprint,
        nom_s: s.nom_s,
        date_debut_s: s.date_debut_s,
        date_fin_s: s.date_fin_s,
        id_projet: s.id_projet,
        lists: sprintLists.map(buildList),
        task_count: countTasksFor((t) => t.id_sprint === s.id_sprint),
      };
    };

    const projectSprints = (sprintsFlat as any[]).map(buildSprint);

    const treeAuth = serializeWorkspaceProjectAuth(user, treePermCtx);

    return res.json({
      id_projet: project.id_projet,
      nom_p: project.nom_p,
      description_p: project.description_p,
      date_debut: project.date_debut,
      date_fin: project.date_fin,
      statut_p: project.statut_p,
      id_entreprise: project.id_entreprise,
      id_space: (project as any).id_space ?? null,
      entreprise: (project as any).entreprise ?? null,
      groups: [],
      folders: [],
      sprints: projectSprints,
      lists: [],
      task_count: tasks.length,
      currentUserProjectRole: treeAuth.currentUserProjectRole,
      currentUserPermissions: treeAuth.currentUserPermissions,
      project,
      tasks,
    });
  } catch (error) {
    console.error("Erreur récupération arbre projet:", error);
    res.status(500).json({
      error: "Erreur récupération arbre projet",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};