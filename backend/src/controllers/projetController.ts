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
  userCanAccessProjectWorkspace,
  userCanReadProject,
} from "../lib/projectAccess";
import {
  assertProjectPermission,
  getProjectPermissionContext,
  hasProjectPermission,
  serializeWorkspaceProjectAuth,
} from "../services/projectPermission.service";
import { ensureMonEspace } from "../lib/spaceHierarchy";
import {
  isChefDeProjetMemberRole,
  normalizeProjectLocalRole,
  resolveProjectPosteLabel,
} from "../lib/projectRoleLabels";
import {
  filterProjectTeamAddCandidates,
  isGlobalAdminRoleName,
  userCanBeProjectResponsible,
} from "../lib/projectResponsibleCandidates";
import {
  clearAccessGrant,
  removeMembreProjetAccess,
} from "../lib/userAccessGrants";
import {
  mergeActiveProjectWhere,
  PROJECT_ARCHIVED_STATUS,
} from "../lib/projectArchive";
import { filterProjectResponsibleCandidates } from "../lib/projectResponsibleCandidates";
import { computeProjectTaskStatsBatch, computeProjectTaskStats } from "../lib/projectTaskStats";
import { buildProjectNode, loadHierarchyEntities } from "../lib/spaceHierarchy";

const CHEF_DE_PROJET_ROLE_LABEL = "Chef de projet";

type ProjetMembreRow = {
  id_utilisateur: number;
  role_projet: string | null;
  utilisateur: {
    id_utilisateur: number;
    nom: string | null;
    prenom: string | null;
    email: string | null;
  } | null;
};

function mapProjetMembreRows(rows: ProjetMembreRow[]) {
  return rows
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
}

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
    const rawRole = String(
      (m as any).role_in_project ??
        (m as any).roleInProject ??
        (m as any).roleProjet ??
        (m as any).role_projet ??
        (m as any).role ??
        (m as any).projectRole ??
        ""
    ).trim();
    const role = normalizeProjectLocalRole(rawRole || "Développeur");
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

/** Utilisateurs éligibles comme responsable de projet (profil Chef de projet ou permissions clés). */
export const getProjectResponsibleCandidates = async (
  req: Request,
  res: Response
) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const user = (req as any).user;
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ message: "ID projet invalide." });
    }

    const permCtx = await getProjectPermissionContext(user, id);
    const canPick =
      permCtx.fullAccess ||
      hasProjectPermission(permCtx, "edit_project") ||
      hasProjectPermission(permCtx, "TEAM_MANAGE");
    if (!canPick) {
      return res.status(403).json({
        message: "Permission refusée",
        code: "PROJECT_PERMISSION_DENIED",
        requiredPermission: "edit_project",
      });
    }

    const projet = await prisma.projet.findUnique({
      where: { id_projet: id },
      select: { id_entreprise: true, chef_de_projet_id: true },
    });
    if (!projet?.id_entreprise) {
      return res.status(404).json({ message: "Projet inexistant" });
    }

    const utilisateurs = await prisma.utilisateur.findMany({
      where: { id_entreprise: projet.id_entreprise },
      select: utilisateurListCoreSelect,
      orderBy: [{ prenom: "asc" }, { nom: "asc" }],
    });

    const eligible = await filterProjectResponsibleCandidates(
      projet.id_entreprise,
      utilisateurs
    );

    res.json(eligible);
  } catch (error) {
    console.error("[getProjectResponsibleCandidates] error:", error);
    res.status(500).json({
      message: "Erreur lors du chargement des responsables éligibles",
    });
  }
};

/**
 * Tous les utilisateurs non-admin de l'entreprise (picker « Ajouter un membre »).
 * N'exclut pas membre_projet côté serveur : le client filtre la liste affichée.
 */
export const getProjectTeamCandidates = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const user = (req as any).user;
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ message: "ID projet invalide." });
    }

    const projet = await prisma.projet.findUnique({
      where: { id_projet: id },
      select: { id_entreprise: true },
    });
    if (!projet?.id_entreprise) {
      return res.status(404).json({ message: "Projet inexistant" });
    }

    const tenantAdminOnProject =
      isTenantAdminUser(user) && projet.id_entreprise === user?.id_entreprise;

    if (!tenantAdminOnProject) {
      const permCtx = await getProjectPermissionContext(user, id);
      const canManageTeam =
        permCtx.fullAccess ||
        hasProjectPermission(permCtx, "TEAM_MANAGE") ||
        hasProjectPermission(permCtx, "manage_project_members");
      if (!canManageTeam) {
        return res.status(403).json({
          message: "Permission refusée : gestion de l'équipe non autorisée",
          code: "PROJECT_PERMISSION_DENIED",
          requiredPermission: "TEAM_MANAGE",
        });
      }
    }

    const utilisateurs = await prisma.utilisateur.findMany({
      where: { id_entreprise: projet.id_entreprise },
      select: {
        ...utilisateurListCoreSelect,
        adminOf: { select: { id_entreprise: true } },
      },
      orderBy: [{ prenom: "asc" }, { nom: "asc" }],
    });

    const eligible = filterProjectTeamAddCandidates(utilisateurs, []);
    res.json(eligible);
  } catch (error) {
    console.error("[getProjectTeamCandidates] error:", error);
    res.status(500).json({
      message: "Erreur lors du chargement des membres disponibles",
    });
  }
};

/** Membres actuels du projet (assignation tâches, pickers équipe). */
export const getProjectMembers = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const user = (req as any).user;
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ message: "ID projet invalide." });
    }

    const projet = await prisma.projet.findUnique({
      where: { id_projet: id },
      select: {
        id_entreprise: true,
        deleted_at: true,
        membre_projet: {
          select: {
            id_utilisateur: true,
            role_projet: true,
            utilisateur: {
              select: {
                id_utilisateur: true,
                prenom: true,
                nom: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!projet || projet.deleted_at) {
      return res.status(404).json({ message: "Projet inexistant" });
    }

    if (
      !userCanReadProject(user, {
        id_entreprise: projet.id_entreprise,
        membre_projet: projet.membre_projet,
      })
    ) {
      return res.status(403).json({ message: PROJECT_READ_FORBIDDEN_MESSAGE });
    }

    const permCtx = await getProjectPermissionContext(user, id);
    const canListMembers =
      permCtx.fullAccess ||
      hasProjectPermission(permCtx, "PROJECT_VIEW") ||
      hasProjectPermission(permCtx, "TASK_ASSIGN") ||
      hasProjectPermission(permCtx, "TASK_EDIT_ALL");
    if (!canListMembers) {
      return res.status(403).json({ message: PROJECT_READ_FORBIDDEN_MESSAGE });
    }

    res.json({ members: mapProjetMembreRows(projet.membre_projet || []) });
  } catch (error) {
    console.error("[getProjectMembers] error:", error);
    res.status(500).json({
      message: "Erreur lors du chargement des membres du projet",
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
      select: {
        id_utilisateur: true,
        id_entreprise: true,
        poste: true,
        role: { select: { nom: true } },
      },
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
      if (isGlobalAdminRoleName(u.role?.nom ?? null)) {
        return res.status(400).json({
          message:
            "Les administrateurs ne peuvent pas être ajoutés comme membres du projet.",
        });
      }
    }

    const chefUser = teamUsers.find((u) => u.id_utilisateur === chefId);
    if (
      !chefUser ||
      !(await userCanBeProjectResponsible(entId, chefUser))
    ) {
      return res.status(400).json({
        message:
          "Le responsable sélectionné n'est pas éligible (profil Chef de projet ou permissions de gestion requises).",
      });
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
        const localRole = normalizeProjectLocalRole(m.projectRole);
        await ensureProjectAffectationTx(tx, id, m.userId, "membre");
        await upsertMembreProjetRow(tx, id, m.userId, localRole);
      }
    });

    res.json({
      message: "Équipe du projet mise à jour",
      id_projet: id,
      project_members: [
        { user_id: chefId, project_id: id, role_in_project: CHEF_DE_PROJET_ROLE_LABEL },
        ...membersPayload.map((m) => ({
          user_id: m.userId,
          project_id: id,
          role_in_project: normalizeProjectLocalRole(m.projectRole),
        })),
      ],
    });
  } catch (error) {
    console.error("replaceProjetTeam error:", error);
    res.status(500).json({
      message:
        error instanceof Error ? error.message : "Erreur mise à jour de l'équipe",
    });
  }
};

/**
 * Retire un membre de l'équipe projet (`membre_projet` + affectations projet).
 * Ne supprime pas le compte utilisateur.
 */
export const removeProjectTeamMember = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const memberUserId = parseInt(req.params.userId as string, 10);
    const user = (req as any).user;

    if (!Number.isFinite(id) || id < 1 || !Number.isFinite(memberUserId) || memberUserId < 1) {
      return res.status(400).json({ message: "Identifiants invalides." });
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
        });
      }
    }

    const projet = await prisma.projet.findUnique({
      where: { id_projet: id },
      select: {
        id_projet: true,
        id_entreprise: true,
        chef_de_projet_id: true,
        deleted_at: true,
        membre_projet: {
          select: {
            id_utilisateur: true,
            role_projet: true,
          },
        },
      },
    });

    if (!projet || projet.deleted_at) {
      return res.status(404).json({ message: "Projet inexistant" });
    }

    const membership = projet.membre_projet.find(
      (m) => m.id_utilisateur === memberUserId
    );
    if (!membership) {
      return res.status(404).json({
        message: "Ce membre ne fait pas partie de l'équipe du projet.",
      });
    }

    if (projet.chef_de_projet_id === memberUserId) {
      return res.status(400).json({
        message:
          "Ce membre est le responsable du projet. Assignez un autre Chef de projet avant de le retirer.",
        code: "PROJECT_CHEF_ASSIGNED",
      });
    }

    const otherChefCount = projet.membre_projet.filter(
      (m) =>
        m.id_utilisateur !== memberUserId &&
        isChefDeProjetMemberRole(m.role_projet)
    ).length;

    if (
      isChefDeProjetMemberRole(membership.role_projet) &&
      otherChefCount === 0
    ) {
      return res.status(400).json({
        message:
          "Impossible de retirer le dernier Chef de projet. Assignez un autre responsable avant de continuer.",
        code: "LAST_CHEF_DE_PROJET",
      });
    }

    await prisma.$transaction(async (tx) => {
      await removeMembreProjetAccess(id, memberUserId, tx);
      if (projet.id_entreprise) {
        await clearAccessGrant({
          userId: memberUserId,
          resourceType: "PROJECT",
          resourceId: id,
          tx,
        });
      }
    });

    const updated = await prisma.projet.findUnique({
      where: { id_projet: id },
      include: {
        membre_projet: {
          include: {
            utilisateur: {
              select: utilisateurPublicChefSelect,
            },
          },
        },
        _count: { select: { membre_projet: true } },
      },
    });

    const projectTeam = mapProjetMembreRows(updated?.membre_projet || []);

    res.json({
      message: "Membre retiré de l'équipe du projet.",
      id_projet: id,
      userId: memberUserId,
      projectTeam,
      memberCount: updated?._count.membre_projet ?? projectTeam.length,
    });
  } catch (error) {
    console.error("removeProjectTeamMember error:", error);
    res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Erreur lors du retrait du membre",
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

    const includeArchived = req.query.includeArchived === "true";
    const where = mergeActiveProjectWhere(whereClause, includeArchived);

    const projets = await prisma.projet.findMany({
      where,
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
          select: { membre_projet: true },
        },
      },
      orderBy: { id_projet: "desc" },
    });

    const projectIds = projets.map((p) => p.id_projet);
    const taskStatsByProject = await computeProjectTaskStatsBatch(projectIds);

    const projetsWithProgress = projets.map(p => {
      const stats = taskStatsByProject.get(p.id_projet) ?? {
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        lateTasks: 0,
        todoTasks: 0,
        avancement: 0,
      };
      const {
        totalTasks,
        completedTasks,
        inProgressTasks,
        lateTasks,
        todoTasks,
        avancement,
      } = stats;

      const { _count, entreprise, affectation, chef_de_projet, ...rest } = p;
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
        inProgressTasks,
        lateTasks,
        todoTasks,
        avancement,
        progressPercent: avancement,
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
        tachesCount: totalTasks,
        _count: {
          tache: totalTasks,
          membre_projet: _count?.membre_projet ?? 0,
        },
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



export const getProjetStats = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const user = (req as any).user;
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "ID projet invalide" });
    }

    const projet = await prisma.projet.findUnique({
      where: { id_projet: id },
      select: {
        id_projet: true,
        id_entreprise: true,
        membre_projet: { select: { id_utilisateur: true } },
      },
    });
    if (!projet) {
      return res.status(404).json({ message: "Projet inexistant" });
    }
    if (!userCanReadProject(user, projet)) {
      return res.status(403).json({ message: PROJECT_READ_FORBIDDEN_MESSAGE });
    }

    const permCtx = await getProjectPermissionContext(user, id);
    if (!permCtx.fullAccess && !hasProjectPermission(permCtx, "view_project")) {
      return res.status(403).json({ message: PROJECT_READ_FORBIDDEN_MESSAGE });
    }

    const stats = await computeProjectTaskStats(id);
    return res.json({
      id_projet: id,
      ...stats,
      tachesCount: stats.totalTasks,
      progressPercent: stats.avancement,
    });
  } catch (error) {
    console.error("[getProjetStats] error:", error);
    res.status(500).json({
      error: "Erreur statistiques projet",
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
      id_projet: projet.id_projet,
      id_entreprise: projet.id_entreprise,
      chef_de_projet_id: projet.chef_de_projet_id,
      membre_projet: projet.membre_projet,
    };
    if (!(await userCanAccessProjectWorkspace(user, gatePayload))) {
      return res.status(403).json({ message: PROJECT_READ_FORBIDDEN_MESSAGE });
    }

    const stats = await computeProjectTaskStats(id);
    const {
      totalTasks,
      completedTasks,
      inProgressTasks,
      lateTasks,
      todoTasks,
      avancement,
    } = stats;
    
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

    const projectTeam = mapProjetMembreRows(projet.membre_projet || []);

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
      inProgressTasks,
      lateTasks,
      todoTasks,
      tachesCount: totalTasks,
      progressPercent: avancement,
      _count: {
        tache: totalTasks,
        membres:
          projectTeam.length > 0
            ? projectTeam.length
            : projet.membre_projet?.length ?? 0,
      },
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

export const archiveProjet = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "ID projet invalide" });
    }
    const user = (req as any).user;
    const project = await prisma.projet.findUnique({
      where: { id_projet: id },
      select: { id_projet: true, id_entreprise: true, statut_p: true },
    });
    if (!project) {
      return res.status(404).json({ message: "Projet introuvable" });
    }

    if (isTenantAdminUser(user)) {
      const entId = user?.id_entreprise;
      if (entId != null && project.id_entreprise !== entId) {
        return res.status(403).json({ message: "Accès refusé" });
      }
    } else if (!isSuperAdmin(user)) {
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
    }

    await prisma.projet.update({
      where: { id_projet: id },
      data: { statut_p: PROJECT_ARCHIVED_STATUS },
    });

    res.json({ message: "Projet archivé", id_projet: id });
  } catch (error) {
    console.error("[archiveProjet]", error);
    res.status(500).json({ error: "Erreur archivage projet" });
  }
};

export const deleteProjet = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const user = (req as any).user;

    if (isTenantAdminUser(user)) {
      const project = await prisma.projet.findUnique({
        where: { id_projet: id },
        select: { id_entreprise: true },
      });
      if (!project) {
        return res.status(404).json({ message: "Projet introuvable" });
      }
      const entId = user?.id_entreprise;
      if (entId != null && project.id_entreprise !== entId) {
        return res.status(403).json({ message: "Accès refusé" });
      }
    } else {
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
    }

    await prisma.projet.delete({
      where: { id_projet: id },
    });

    res.json({ message: "Projet supprimé" });
  } catch (error) {
    console.error("[deleteProjet]", error);
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
        id_projet: true,
        id_entreprise: true,
        chef_de_projet_id: true,
        membre_projet: {
          select: { id_utilisateur: true, role_projet: true },
        },
      },
    });
    if (!gate) {
      return res.status(404).json({ message: "Projet introuvable" });
    }
    if (!(await userCanAccessProjectWorkspace(user, gate))) {
      return res.status(403).json({ message: PROJECT_READ_FORBIDDEN_MESSAGE });
    }

    const treePermCtx = await getProjectPermissionContext(user, id);

    const { sprintsFlat, listsFlat, tasks: hierarchyTasks } =
      await loadHierarchyEntities([id]);

    const projectNode = await buildProjectNode(
      project,
      sprintsFlat,
      listsFlat,
      hierarchyTasks,
      user
    );

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
      sprints: projectNode.sprints,
      lists: [],
      task_count: projectNode.task_count,
      hasAccessibleContent: projectNode.hasAccessibleContent,
      currentUserProjectRole:
        projectNode.currentUserProjectRole ?? treeAuth.currentUserProjectRole,
      currentUserPermissions:
        projectNode.currentUserPermissions?.length
          ? projectNode.currentUserPermissions
          : treeAuth.currentUserPermissions,
      project,
    });
  } catch (error) {
    console.error("Erreur récupération arbre projet:", error);
    res.status(500).json({
      error: "Erreur récupération arbre projet",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};