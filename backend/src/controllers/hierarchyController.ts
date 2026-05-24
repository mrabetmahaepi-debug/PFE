import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";
import { isSuperAdmin, userHasPermission } from "../middleware/permissions";
import {
  normalizeStatutKey,
  syncOverdueForTasks,
} from "../lib/taskStatutWorkflow";
import {
  getProjectPermissionContext,
  requestCanWriteLists,
  serializeWorkspaceProjectAuth,
} from "../services/projectPermission.service";
import {
  filterTasksForProjectContext,
  userCanAccessListInProject,
} from "../lib/sidebarAccessFilter";
import {
  PROJECT_READ_FORBIDDEN_MESSAGE,
  userCanAccessProjectWorkspace,
} from "../lib/projectAccess";
import {
  createFolderInSpace,
  createListInSpace,
  moveListToTrash,
  restoreListFromTrash,
} from "../lib/spaceHierarchy";
import { logMemberWorkspaceActivity } from "../services/enterpriseActivity.service";

const db = prisma as any;

function hierarchyActivityUser(user: {
  prenom?: string | null;
  nom?: string | null;
  email?: string | null;
}): string {
  const name = `${user.prenom || ""} ${user.nom || ""}`.trim();
  return name || user.email || "Membre";
}

function toInt(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function getAccessibleProject(req: Request, projectId: number) {
  const user = (req as any).user;
  const project = await prisma.projet.findUnique({
    where: { id_projet: projectId },
    select: {
      id_projet: true,
      id_entreprise: true,
      chef_de_projet_id: true,
      membre_projet: {
        select: { id_utilisateur: true, role_projet: true },
      },
    },
  });
  if (!project) return null;
  if (isSuperAdmin(user)) return project;
  const gate = { ...project, id_projet: project.id_projet };
  if (!(await userCanAccessProjectWorkspace(user, gate))) {
    throw new Error("FORBIDDEN_PROJECT");
  }
  return project;
}

async function ensureProjectScopedAncestors(input: {
  id_projet: number;
  id_group?: number | null;
  id_folder?: number | null;
  id_sprint?: number | null;
}) {
  const { id_projet, id_group, id_folder, id_sprint } = input;

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

  if (id_sprint) {
    const sprint = await prisma.sprint.findUnique({ where: { id_sprint } });
    if (!sprint || sprint.id_projet !== id_projet) {
      throw new Error("Le sprint n'appartient pas à ce projet");
    }
    if (id_group && (sprint as any).id_group && (sprint as any).id_group !== id_group) {
      throw new Error("Le sprint n'appartient pas à ce groupe");
    }
    if (
      id_folder &&
      (sprint as any).id_folder &&
      (sprint as any).id_folder !== id_folder
    ) {
      throw new Error("Le sprint n'appartient pas à ce dossier");
    }
  }
}

function handleHierarchyError(res: Response, err: any) {
  if (err?.message === "FORBIDDEN_PROJECT") {
    return res.status(403).json({ message: PROJECT_READ_FORBIDDEN_MESSAGE });
  }
  if (typeof err?.message === "string" && err.message.includes("appartient")) {
    return res.status(400).json({ message: err.message });
  }
  console.error("Hierarchy controller error:", err);
  return res.status(500).json({ message: "Erreur serveur" });
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export const createGroup = async (req: Request, res: Response) => {
  try {
    const id_projet = toInt(req.body.id_projet);
    if (!id_projet) return res.status(400).json({ message: "id_projet requis" });
    const project = await getAccessibleProject(req, id_projet);
    if (!project) return res.status(404).json({ message: "Projet introuvable" });

    const group = await db.group_pm.create({
      data: {
        nom: req.body.nom,
        description: req.body.description ?? null,
        color: req.body.color ?? null,
        position: Number(req.body.position ?? 0),
        id_projet,
      },
    });
    return res.status(201).json(group);
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

export const getGroupsByProject = async (req: Request, res: Response) => {
  try {
    const id_projet = toInt(req.params.id_projet);
    if (!id_projet) return res.status(400).json({ message: "id_projet invalide" });
    const project = await getAccessibleProject(req, id_projet);
    if (!project) return res.status(404).json({ message: "Projet introuvable" });

    const groups = await db.group_pm.findMany({
      where: { id_projet },
      orderBy: [{ position: "asc" }, { id_group: "asc" }],
    });
    return res.json(groups);
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

export const updateGroup = async (req: Request, res: Response) => {
  try {
    const id_group = toInt(req.params.id);
    if (!id_group) return res.status(400).json({ message: "id_group invalide" });
    const current = await db.group_pm.findUnique({ where: { id_group } });
    if (!current) return res.status(404).json({ message: "Groupe introuvable" });
    await getAccessibleProject(req, current.id_projet);

    const group = await db.group_pm.update({
      where: { id_group },
      data: {
        nom: req.body.nom ?? undefined,
        description: req.body.description ?? undefined,
        color: req.body.color ?? undefined,
        position:
          req.body.position !== undefined ? Number(req.body.position) : undefined,
      },
    });
    return res.json(group);
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

export const deleteGroup = async (req: Request, res: Response) => {
  try {
    const id_group = toInt(req.params.id);
    if (!id_group) return res.status(400).json({ message: "id_group invalide" });
    const current = await db.group_pm.findUnique({ where: { id_group } });
    if (!current) return res.status(404).json({ message: "Groupe introuvable" });
    await getAccessibleProject(req, current.id_projet);

    await db.group_pm.delete({ where: { id_group } });
    return res.json({ message: "Groupe supprimé" });
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export const createFolder = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const spaceId = toInt(req.body.spaceId ?? req.body.id_space);
    const name = String(req.body.name ?? req.body.nom ?? "").trim();

    if (spaceId && name) {
      const canCreate =
        isSuperAdmin(user) ||
        (await userHasPermission(req, "PROJECT_CREATE")) ||
        (await userHasPermission(req, "FOLDER_MANAGE"));
      if (!canCreate) {
        return res.status(403).json({ message: "Permission refusée" });
      }
      const folder = await createFolderInSpace(spaceId, name, user);
      const projectId = Number(
        (folder as { id_projet?: number; folderId?: number }).id_projet ??
          (folder as { folderId?: number }).folderId
      );
      if (Number.isFinite(projectId) && projectId > 0) {
        await logMemberWorkspaceActivity({
          user: hierarchyActivityUser(user),
          action: "Projet créé",
          type: "project",
          projectId,
          projectName: name,
        });
      }
      return res.status(201).json(folder);
    }

    const id_projet = toInt(req.body.id_projet);
    const id_group = toInt(req.body.id_group);
    if (!id_projet) return res.status(400).json({ message: "id_projet requis" });
    const project = await getAccessibleProject(req, id_projet);
    if (!project) return res.status(404).json({ message: "Projet introuvable" });
    await ensureProjectScopedAncestors({ id_projet, id_group });

    const folder = await db.folder_pm.create({
      data: {
        nom: req.body.nom,
        description: req.body.description ?? null,
        position: Number(req.body.position ?? 0),
        id_projet,
        id_group,
      },
    });
    return res.status(201).json(folder);
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

export const getFoldersByProject = async (req: Request, res: Response) => {
  try {
    const id_projet = toInt(req.params.id_projet);
    if (!id_projet) return res.status(400).json({ message: "id_projet invalide" });
    const project = await getAccessibleProject(req, id_projet);
    if (!project) return res.status(404).json({ message: "Projet introuvable" });

    const folders = await db.folder_pm.findMany({
      where: { id_projet },
      orderBy: [{ position: "asc" }, { id_folder: "asc" }],
    });
    return res.json(folders);
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

export const updateFolder = async (req: Request, res: Response) => {
  try {
    const id_folder = toInt(req.params.id);
    if (!id_folder) return res.status(400).json({ message: "id_folder invalide" });
    const current = await db.folder_pm.findUnique({ where: { id_folder } });
    if (!current) return res.status(404).json({ message: "Dossier introuvable" });
    await getAccessibleProject(req, current.id_projet);
    const nextGroup = req.body.id_group !== undefined ? toInt(req.body.id_group) : current.id_group;
    await ensureProjectScopedAncestors({ id_projet: current.id_projet, id_group: nextGroup });

    const folder = await db.folder_pm.update({
      where: { id_folder },
      data: {
        nom: req.body.nom ?? undefined,
        description: req.body.description ?? undefined,
        position:
          req.body.position !== undefined ? Number(req.body.position) : undefined,
        id_group: req.body.id_group !== undefined ? nextGroup : undefined,
      },
    });
    return res.json(folder);
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

export const deleteFolder = async (req: Request, res: Response) => {
  try {
    const id_folder = toInt(req.params.id);
    if (!id_folder) return res.status(400).json({ message: "id_folder invalide" });
    const current = await db.folder_pm.findUnique({ where: { id_folder } });
    if (!current) return res.status(404).json({ message: "Dossier introuvable" });
    await getAccessibleProject(req, current.id_projet);

    await db.folder_pm.delete({ where: { id_folder } });
    return res.json({ message: "Dossier supprimé" });
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export const createList = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const spaceId = toInt(req.body.spaceId ?? req.body.id_space);
    const folderId = toInt(req.body.folderId ?? req.body.id_folder);
    const name = String(req.body.name ?? req.body.nom ?? "").trim();

    if (spaceId && name) {
      let targetProjectId = folderId;
      if (!targetProjectId) {
        const first = await prisma.projet.findFirst({
          where: {
            id_space: spaceId,
            id_entreprise: user.id_entreprise ?? undefined,
            deleted_at: null,
          },
          orderBy: { id_projet: "asc" },
          select: { id_projet: true },
        });
        targetProjectId = first?.id_projet ?? null;
      }
      if (!targetProjectId) {
        return res.status(400).json({
          message: "Créez un dossier avant une liste dans cet espace.",
        });
      }
      const canCreate = await requestCanWriteLists(req, targetProjectId);
      if (!canCreate) {
        return res.status(403).json({ message: "Permission refusée" });
      }
      try {
        const list = await createListInSpace(
          spaceId,
          folderId,
          name,
          user
        );
        const projectId = Number(
          (list as { folderId?: number }).folderId ?? targetProjectId
        );
        const project = await prisma.projet.findUnique({
          where: { id_projet: projectId },
          select: { nom_p: true },
        });
        await logMemberWorkspaceActivity({
          user: hierarchyActivityUser(user),
          action: "Liste créée",
          type: "project",
          projectId,
          projectName: project?.nom_p?.trim() || "Projet",
          taskTitle: name,
        });
        return res.status(201).json(list);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "FOLDER_REQUIRED") {
          return res.status(400).json({
            message: "Créez un dossier avant une liste dans cet espace.",
          });
        }
        if (msg === "SPACE_NOT_FOUND" || msg === "FOLDER_NOT_IN_SPACE") {
          return res.status(404).json({ message: "Espace ou dossier introuvable" });
        }
        throw err;
      }
    }

    const id_projet = toInt(req.body.id_projet);
    const id_sprint = toInt(req.body.id_sprint);
    if (!id_projet) return res.status(400).json({ message: "id_projet requis" });
    if (!id_sprint) {
      return res.status(400).json({ message: "id_sprint requis (liste rattachée à un sprint)" });
    }
    const project = await getAccessibleProject(req, id_projet);
    if (!project) return res.status(404).json({ message: "Projet introuvable" });
    await ensureProjectScopedAncestors({ id_projet, id_sprint });

    const list = await db.list_pm.create({
      data: {
        nom: req.body.nom,
        description: req.body.description ?? null,
        position: Number(req.body.position ?? 0),
        id_projet,
        id_sprint,
      },
    });
    return res.status(201).json(list);
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

export const getListsByProject = async (req: Request, res: Response) => {
  try {
    const id_projet = toInt(req.params.id_projet);
    if (!id_projet) return res.status(400).json({ message: "id_projet invalide" });
    const project = await getAccessibleProject(req, id_projet);
    if (!project) return res.status(404).json({ message: "Projet introuvable" });

    const lists = await db.list_pm.findMany({
      where: { id_projet },
      orderBy: [{ position: "asc" }, { id_list: "asc" }],
    });
    return res.json(lists);
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

export const updateList = async (req: Request, res: Response) => {
  try {
    const id_list = toInt(req.params.id);
    if (!id_list) return res.status(400).json({ message: "id_list invalide" });
    const current = await db.list_pm.findUnique({ where: { id_list } });
    if (!current) return res.status(404).json({ message: "Liste introuvable" });
    await getAccessibleProject(req, current.id_projet);

    const id_group = req.body.id_group !== undefined ? toInt(req.body.id_group) : current.id_group;
    const id_folder = req.body.id_folder !== undefined ? toInt(req.body.id_folder) : current.id_folder;
    const id_sprint = req.body.id_sprint !== undefined ? toInt(req.body.id_sprint) : current.id_sprint;
    await ensureProjectScopedAncestors({
      id_projet: current.id_projet,
      id_group,
      id_folder,
      id_sprint,
    });

    const list = await db.list_pm.update({
      where: { id_list },
      data: {
        nom: req.body.nom ?? undefined,
        description: req.body.description ?? undefined,
        position:
          req.body.position !== undefined ? Number(req.body.position) : undefined,
        id_group: req.body.id_group !== undefined ? id_group : undefined,
        id_folder: req.body.id_folder !== undefined ? id_folder : undefined,
        id_sprint: req.body.id_sprint !== undefined ? id_sprint : undefined,
      },
    });
    return res.json(list);
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

export const trashList = async (req: Request, res: Response) => {
  try {
    const id_list = toInt(req.params.id);
    if (!id_list) return res.status(400).json({ message: "id_list invalide" });
    const current = await db.list_pm.findUnique({ where: { id_list } });
    if (!current) return res.status(404).json({ message: "Liste introuvable" });
    await getAccessibleProject(req, current.id_projet);
    const user = (req as any).user;
    const deletedBy = Number(user?.id_utilisateur ?? user?.id) || null;
    await moveListToTrash(id_list, deletedBy);
    return res.json({ message: "Liste déplacée vers la corbeille" });
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

export const restoreList = async (req: Request, res: Response) => {
  try {
    const id_list = toInt(req.params.id);
    if (!id_list) return res.status(400).json({ message: "id_list invalide" });
    const current = await db.list_pm.findUnique({ where: { id_list } });
    if (!current) return res.status(404).json({ message: "Liste introuvable" });
    await getAccessibleProject(req, current.id_projet);
    await restoreListFromTrash(id_list);
    return res.json({ message: "Liste restaurée" });
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

export const deleteList = async (req: Request, res: Response) => {
  try {
    const id_list = toInt(req.params.id);
    if (!id_list) return res.status(400).json({ message: "id_list invalide" });
    const current = await db.list_pm.findUnique({ where: { id_list } });
    if (!current) return res.status(404).json({ message: "Liste introuvable" });
    await getAccessibleProject(req, current.id_projet);

    await db.list_pm.delete({ where: { id_list } });
    return res.json({ message: "Liste supprimée" });
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

/** GET /projects/:id/sprints — sprints with nested lists */
export const getSprintsByProject = async (req: Request, res: Response) => {
  try {
    const id_projet = toInt(req.params.id ?? req.params.id_projet);
    if (!id_projet) return res.status(400).json({ message: "id_projet invalide" });
    const project = await getAccessibleProject(req, id_projet);
    if (!project) return res.status(404).json({ message: "Projet introuvable" });

    const [sprints, lists] = await Promise.all([
      prisma.sprint.findMany({
        where: { id_projet, deleted_at: null },
        orderBy: [{ id_sprint: "asc" }],
      }),
      db.list_pm.findMany({
        where: { id_projet, deleted_at: null },
        orderBy: [{ position: "asc" }, { id_list: "asc" }],
      }),
    ]);
    const sprintIds = sprints.map((s) => s.id_sprint);
    const listIds = lists.map((l: { id_list: number }) => l.id_list);
    const { buildProjectTasksWhere } = await import("../lib/projectTaskStats");
    const tasks = await prisma.tache.findMany({
      where: buildProjectTasksWhere([id_projet], sprintIds, listIds),
      select: { id_tache: true, id_list: true, id_sprint: true },
    });

    const payload = sprints.map((s) => {
      const sprintLists = (lists as any[]).filter(
        (l: any) => l.id_sprint === s.id_sprint
      );
      return {
        id_sprint: s.id_sprint,
        nom_s: s.nom_s,
        id_projet: s.id_projet,
        lists: sprintLists.map((l: any) => ({
          id_list: l.id_list,
          nom: l.nom,
          id_sprint: l.id_sprint,
          task_count: tasks.filter((t) => t.id_list === l.id_list).length,
        })),
        task_count: tasks.filter((t) => t.id_sprint === s.id_sprint).length,
      };
    });

    return res.json({ id_projet, sprints: payload });
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

/** GET /sprints/:id/lists */
export const getListsBySprint = async (req: Request, res: Response) => {
  try {
    const id_sprint = toInt(req.params.id ?? req.params.id_sprint);
    if (!id_sprint) return res.status(400).json({ message: "id_sprint invalide" });
    const sprint = await prisma.sprint.findUnique({ where: { id_sprint } });
    if (!sprint?.id_projet) {
      return res.status(404).json({ message: "Sprint introuvable" });
    }
    const project = await getAccessibleProject(req, sprint.id_projet);
    if (!project) return res.status(404).json({ message: "Projet introuvable" });

    const lists = await db.list_pm.findMany({
      where: { id_sprint },
      orderBy: [{ position: "asc" }, { id_list: "asc" }],
    });
    return res.json({ id_sprint, lists });
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

/** GET /lists/:id — list metadata with project/sprint context */
export const getListById = async (req: Request, res: Response) => {
  try {
    const id_list = toInt(req.params.id ?? req.params.id_list);
    if (!id_list) return res.status(400).json({ message: "id_list invalide" });
    const list = await db.list_pm.findUnique({ where: { id_list } });
    if (!list) return res.status(404).json({ message: "Liste introuvable" });
    const project = await getAccessibleProject(req, list.id_projet);
    if (!project) return res.status(404).json({ message: "Projet introuvable" });

    const user = (req as any).user;
    const permCtx = await getProjectPermissionContext(user, list.id_projet);
    if (!(await userCanAccessListInProject(Number(user?.id), permCtx, id_list))) {
      return res.status(403).json({
        message: "Vous n'avez pas accès à cette liste.",
      });
    }
    const listAuth = serializeWorkspaceProjectAuth(user, permCtx);

    const [projet, sprint, tasksRaw] = await Promise.all([
      prisma.projet.findUnique({
        where: { id_projet: list.id_projet },
        select: {
          id_projet: true,
          nom_p: true,
          description_p: true,
          id_space: true,
        },
      }),
      list.id_sprint
        ? prisma.sprint.findUnique({
            where: { id_sprint: list.id_sprint },
            select: {
              id_sprint: true,
              nom_s: true,
              date_debut_s: true,
              date_fin_s: true,
            },
          })
        : Promise.resolve(null),
      prisma.tache.findMany({
        where: { id_list, deleted_at: null },
        select: { statut_t: true, assigne_a: true },
      }),
    ]);
    const userId = Number(user?.id);
    const tasks = filterTasksForProjectContext(
      permCtx,
      tasksRaw,
      Number.isFinite(userId) ? userId : 0
    );

    let todo = 0;
    let inProgress = 0;
    let done = 0;
    for (const t of tasks) {
      const k = normalizeStatutKey(t.statut_t);
      if (k === "terminee") done++;
      else if (k === "en_cours" || k === "en_retard") inProgress++;
      else todo++;
    }

    return res.json({
      id_list: list.id_list,
      nom: list.nom,
      description: list.description ?? null,
      position: list.position ?? 0,
      id_projet: list.id_projet,
      id_sprint: list.id_sprint ?? null,
      projet: projet
        ? {
            id_projet: projet.id_projet,
            nom_p: projet.nom_p,
            description_p: projet.description_p,
            id_space: (projet as any).id_space ?? null,
          }
        : null,
      sprint: sprint
        ? {
            id_sprint: sprint.id_sprint,
            nom_s: sprint.nom_s,
            date_debut_s: sprint.date_debut_s,
            date_fin_s: sprint.date_fin_s,
          }
        : null,
      task_count: tasks.length,
      stats: { todo, inProgress, done, total: tasks.length },
      currentUserProjectRole: listAuth.currentUserProjectRole,
      currentUserPermissions: listAuth.currentUserPermissions,
    });
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

/** GET /lists/:id/tasks */
export const getTasksByList = async (req: Request, res: Response) => {
  try {
    const id_list = toInt(req.params.id ?? req.params.id_list);
    if (!id_list) return res.status(400).json({ message: "id_list invalide" });
    const list = await db.list_pm.findUnique({ where: { id_list } });
    if (!list) return res.status(404).json({ message: "Liste introuvable" });
    const project = await getAccessibleProject(req, list.id_projet);
    if (!project) return res.status(404).json({ message: "Projet introuvable" });

    const user = (req as any).user;
    const ctx = await getProjectPermissionContext(user, list.id_projet);
    if (!(await userCanAccessListInProject(Number(user?.id), ctx, id_list))) {
      return res.status(403).json({
        message: "Vous n'avez pas accès à cette liste.",
      });
    }
    const tasksRaw = await prisma.tache.findMany({
      where: { id_list, deleted_at: null },
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
    });
    const userId = Number(user?.id);
    const tasks = filterTasksForProjectContext(
      ctx,
      tasksRaw,
      Number.isFinite(userId) ? userId : 0
    );
    const synced = await syncOverdueForTasks(tasks);
    return res.json({ id_list, tasks: synced });
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

/** GET /lists/:id/statuses */
export const getListStatuses = async (req: Request, res: Response) => {
  try {
    const id_list = toInt(req.params.id);
    if (!id_list) return res.status(400).json({ message: "id_list invalide" });
    const list = await db.list_pm.findUnique({ where: { id_list } });
    if (!list) return res.status(404).json({ message: "Liste introuvable" });
    const project = await getAccessibleProject(req, list.id_projet);
    if (!project) return res.status(404).json({ message: "Projet introuvable" });

    const { ensureListStatuses } = await import(
      "../services/listStatus.service"
    );
    const statuses = await ensureListStatuses(id_list);
    return res.json({ id_list, statuses });
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};

/** POST /lists/:id/statuses */
export const createListStatusHandler = async (req: Request, res: Response) => {
  try {
    const id_list = toInt(req.params.id);
    if (!id_list) return res.status(400).json({ message: "id_list invalide" });
    const list = await db.list_pm.findUnique({ where: { id_list } });
    if (!list) return res.status(404).json({ message: "Liste introuvable" });
    const project = await getAccessibleProject(req, list.id_projet);
    if (!project) return res.status(404).json({ message: "Projet introuvable" });

    const label = String(req.body?.label ?? req.body?.nom ?? "").trim();
    if (!label) {
      return res.status(400).json({ message: "label est obligatoire" });
    }

    const { createListStatus } = await import("../services/listStatus.service");
    const status = await createListStatus(id_list, label);
    return res.status(201).json({ status });
  } catch (err) {
    return handleHierarchyError(res, err);
  }
};
