import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";
import {
  assertCanAssignTask,
  assertCanCreateTask,
  assertCanDeleteTask,
  assertCanUpdateAssignedTaskStatus,
  assertCanUpdateTask,
  assertCanViewTasks,
  getProjectIdForSprint,
  getProjectPermissionContext,
} from "../services/projectPermission.service";
import {
  createTaskService,
  getAllTasksService,
  getTaskByIdService,
  updateTaskService,
  deleteTaskService,
  assignTaskService,
  getTasksByProjectService,
  getTasksBySprintService,
  getMyTasksService,
  updateMyTaskStatusService,
  getProjectProgress,
  getUserProgress,
  getSprintProgress,
} from "../services/tache.service";
import { normalizeProjectRoleBucket } from "../lib/projectRolePermissions";
import { normalizeCreateTaskPayload } from "../lib/normalizeTaskPayload";

function mapProjectPermError(error: any, res: Response) {
  if (error?.status === 403 && error?.code === "PROJECT_PERMISSION_DENIED") {
    return res.status(403).json({
      message: error.message,
      code: error.code,
      requiredPermission: error.requiredPermission,
    });
  }
  return null;
}

function projectSeesAllTasks(ctx: {
  fullAccess: boolean;
  roleProjet: string | null;
}): boolean {
  if (ctx.fullAccess) return true;
  return normalizeProjectRoleBucket(ctx.roleProjet) === "CHEF";
}

export const createTask = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const normalized = normalizeCreateTaskPayload(
      (req.body ?? {}) as Record<string, unknown>
    );
    if (!normalized.nom_t) {
      return res.status(400).json({ message: "nom_t / title est obligatoire" });
    }
    const listId =
      normalized.id_list != null && Number(normalized.id_list) > 0
        ? Number(normalized.id_list)
        : null;
    if (!listId) {
      return res.status(400).json({
        message: "id_list / listId est obligatoire",
      });
    }

    const db = prisma as any;
    const listRow = await db.list_pm.findUnique({
      where: { id_list: listId },
      select: { id_projet: true, id_sprint: true },
    });
    if (!listRow) {
      return res.status(400).json({ message: "Liste introuvable" });
    }

    let pid = Number(normalized.id_projet);
    if (!Number.isFinite(pid) || pid < 1) {
      pid = Number(listRow.id_projet);
    }
    if (pid !== Number(listRow.id_projet)) {
      return res.status(400).json({
        message: "La liste n'appartient pas à ce projet",
      });
    }

    const sprintId =
      normalized.id_sprint != null && Number(normalized.id_sprint) > 0
        ? Number(normalized.id_sprint)
        : listRow.id_sprint != null
          ? Number(listRow.id_sprint)
          : null;

    const ctx = await getProjectPermissionContext(user, pid);
    assertCanCreateTask(ctx);

    const assigneeId =
      normalized.assigne_a == null ? NaN : Number(normalized.assigne_a);

    if (!ctx.fullAccess) {
      if (!Number.isFinite(assigneeId) || assigneeId < 1) {
        return res.status(400).json({
          message: "Vous devez assigner la tâche à un membre du projet.",
        });
      }
    }

    if (Number.isFinite(assigneeId) && assigneeId >= 1) {
      const m = await prisma.membre_projet.findFirst({
        where: { id_projet: pid, id_utilisateur: assigneeId },
      });
      if (!m) {
        return res.status(400).json({
          message: "L'utilisateur assigné n'est pas membre de ce projet.",
        });
      }
    }

    const task = await createTaskService({
      nom_t: normalized.nom_t,
      description_t: String(normalized.description_t ?? ""),
      statut_t: normalized.statut_t as string | undefined,
      priorite_t: normalized.priorite_t as string | undefined,
      date_limite_t: normalized.date_limite_t as string | undefined,
      id_projet: pid,
      id_sprint: sprintId ?? undefined,
      id_list: listId,
      id_group: normalized.id_group ?? undefined,
      id_folder: normalized.id_folder ?? undefined,
      assigne_a:
        Number.isFinite(assigneeId) && assigneeId >= 1 ? assigneeId : null,
      cree_par: user.id,
    });
    return res.status(201).json({
      message: "Tâche créée",
      task,
      hierarchy: {
        projectId: task.id_projet,
        sprintId: task.id_sprint ?? null,
        listId: task.id_list ?? null,
        spaceId: normalized.id_space,
      },
    });
  } catch (error: any) {
    if (mapProjectPermError(error, res)) return;
    const msg = String(error?.message || "");
    const hierarchyError = msg.includes("appartient");
    const is400 =
      hierarchyError ||
      [
        "Projet inexistant",
        "Sprint inexistant",
        "Statut invalide",
        "Priorité invalide",
        "Utilisateur inexistant",
        "obligatoires",
        "membre de ce projet",
        "La liste n'appartient",
        "Le sprint n'appartient",
        "Le dossier n'appartient",
        "Le groupe n'appartient",
      ].some((s) => msg.includes(s));
    const status = is400 ? 400 : 500;
    return res.status(status).json({ message: error.message });
  }
};

export const getAllTasks = async (_req: Request, res: Response) => {
  try {
    const tasks = await getAllTasksService();
    return res.status(200).json(tasks);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getTaskById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    const user = (req as any).user;
    const lean = await prisma.tache.findUnique({
      where: { id_tache: id },
      select: { id_projet: true },
    });
    if (!lean?.id_projet) {
      return res.status(404).json({ message: "Tâche inexistante" });
    }
    const ctx = await getProjectPermissionContext(user, Number(lean.id_projet));
    assertCanViewTasks(ctx);

    const task = await getTaskByIdService(id);
    if (!projectSeesAllTasks(ctx) && Number(task.assigne_a) !== user.id) {
      return res.status(403).json({
        message: "Vous n'avez pas accès à cette tâche.",
      });
    }
    return res.status(200).json(task);
  } catch (error: any) {
    if (mapProjectPermError(error, res)) return;
    return res.status(error.message === "Tâche inexistante" ? 404 : 500).json({ message: error.message });
  }
};

export const updateTask = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    const user = (req as any).user;
    const normalized = normalizeCreateTaskPayload(
      (req.body ?? {}) as Record<string, unknown>
    );
    const existing = await prisma.tache.findUnique({
      where: { id_tache: id },
      select: { assigne_a: true, id_projet: true },
    });
    if (!existing?.id_projet) {
      return res.status(404).json({ message: "Tâche inexistante" });
    }
    const ctx = await getProjectPermissionContext(user, Number(existing.id_projet));
    assertCanUpdateTask(ctx, existing, req.body as Record<string, unknown>, user.id);

    const patchBody: Record<string, unknown> = { ...req.body };
    if (normalized.statut_t != null && normalized.statut_t !== "") {
      patchBody.statut_t = normalized.statut_t;
      patchBody.status = normalized.statut_t;
    }

    const task = await updateTaskService(id, patchBody as any);
    return res.status(200).json({ message: "Tâche mise à jour", task });
  } catch (error: any) {
    if (mapProjectPermError(error, res)) return;
    const hierarchyError =
      typeof error.message === "string" && error.message.includes("appartient");
    const status =
      error.message === "Tâche inexistante"
        ? 404
        : hierarchyError || ["Projet inexistant", "Sprint inexistant"].includes(error.message)
          ? 400
          : 500;
    return res.status(status).json({ message: error.message });
  }
};

export const deleteTask = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    const user = (req as any).user;
    const existing = await prisma.tache.findUnique({
      where: { id_tache: id },
      select: { id_projet: true },
    });
    if (!existing?.id_projet) {
      return res.status(404).json({ message: "Tâche inexistante" });
    }
    const ctx = await getProjectPermissionContext(user, Number(existing.id_projet));
    assertCanDeleteTask(ctx);

    await deleteTaskService(id);
    return res.status(200).json({ message: "Tâche supprimée" });
  } catch (error: any) {
    if (mapProjectPermError(error, res)) return;
    return res.status(error.message === "Tâche inexistante" ? 404 : 500).json({ message: error.message });
  }
};

export const assignTask = async (req: Request, res: Response) => {
  try {
    const id_tache = parseInt(req.params.id as string);
    const { id_utilisateur } = req.body;

    if (isNaN(id_tache)) return res.status(400).json({ message: "ID tâche invalide" });
    if (!id_utilisateur) return res.status(400).json({ message: "id_utilisateur est obligatoire" });

    const user = (req as any).user;
    const lean = await prisma.tache.findUnique({
      where: { id_tache: id_tache },
      select: { id_projet: true },
    });
    if (!lean?.id_projet) {
      return res.status(404).json({ message: "Tâche inexistante" });
    }
    const ctx = await getProjectPermissionContext(user, Number(lean.id_projet));
    assertCanAssignTask(ctx);

    const task = await assignTaskService(id_tache, Number(id_utilisateur));
    return res.status(200).json({ message: "Tâche assignée avec succès", task });
  } catch (error: any) {
    if (mapProjectPermError(error, res)) return;
    const status =
      error.message === "Tâche inexistante"
        ? 404
        : ["Utilisateur inexistant", "L'utilisateur n'est pas membre de ce projet", "Cette tâche n'est liée à aucun projet"].includes(error.message)
          ? 400
          : 500;
    return res.status(status).json({ message: error.message });
  }
};

export const getTasksByProject = async (req: Request, res: Response) => {
  try {
    const id_projet = parseInt(req.params.id_projet as string);
    if (isNaN(id_projet)) return res.status(400).json({ message: "ID projet invalide" });

    const user = (req as any).user;
    const ctx = await getProjectPermissionContext(user, id_projet);
    assertCanViewTasks(ctx);

    const seesAll = projectSeesAllTasks(ctx);
    const tasks = await getTasksByProjectService(id_projet, {
      restrictToAssigneeId: seesAll ? undefined : user.id,
    });
    return res.status(200).json(tasks);
  } catch (error: any) {
    if (mapProjectPermError(error, res)) return;
    return res.status(error.message === "Projet inexistant" ? 404 : 500).json({ message: error.message });
  }
};

export const getTasksBySprint = async (req: Request, res: Response) => {
  try {
    const id_sprint = parseInt(req.params.id_sprint as string);
    if (isNaN(id_sprint)) return res.status(400).json({ message: "ID sprint invalide" });

    const user = (req as any).user;
    const projectId = await getProjectIdForSprint(id_sprint);
    if (!projectId) {
      return res.status(404).json({ message: "Sprint inexistant" });
    }
    const ctx = await getProjectPermissionContext(user, projectId);
    assertCanViewTasks(ctx);

    const seesAll = projectSeesAllTasks(ctx);
    const tasks = await getTasksBySprintService(id_sprint, {
      restrictToAssigneeId: seesAll ? undefined : user.id,
    });
    return res.status(200).json(tasks);
  } catch (error: any) {
    if (mapProjectPermError(error, res)) return;
    return res.status(error.message === "Sprint inexistant" ? 404 : 500).json({ message: error.message });
  }
};

export const getMyTasks = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const tasks = await getMyTasksService(userId);
    return res.status(200).json(tasks);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateMyTaskStatus = async (req: any, res: Response) => {
  try {
    const id_tache = parseInt(req.params.id as string);
    const { statut_t } = req.body;
    const userId = req.user.id;

    if (isNaN(id_tache)) return res.status(400).json({ message: "ID tâche invalide" });
    if (!statut_t) return res.status(400).json({ message: "statut_t est obligatoire" });

    const lean = await prisma.tache.findUnique({
      where: { id_tache: id_tache },
      select: { id_projet: true, assigne_a: true },
    });
    if (!lean?.id_projet) {
      return res.status(404).json({ message: "Tâche inexistante" });
    }
    const ctx = await getProjectPermissionContext(req.user, Number(lean.id_projet));
    assertCanUpdateAssignedTaskStatus(ctx, lean, userId);

    const task = await updateMyTaskStatusService(id_tache, userId, statut_t);
    return res.status(200).json({ message: "Statut de la tâche mis à jour", task });
  } catch (error: any) {
    if (mapProjectPermError(error, res)) return;
    const status =
      error.message === "Tâche inexistante"
        ? 404
        : ["Statut invalide", "Cette tâche ne vous est pas assignée"].includes(error.message)
          ? 400
          : 500;
    return res.status(status).json({ message: error.message });
  }
};


export const getProjectProgressController = async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId) || projectId <= 0)
      return res.status(400).json({ message: "projectId invalide" });

    const user = (req as any).user;
    const ctx = await getProjectPermissionContext(user, projectId);
    assertCanViewTasks(ctx);

    const result = await getProjectProgress(projectId);
    return res.status(200).json(result);
  } catch (error: any) {
    if (mapProjectPermError(error, res)) return;
    return res.status(500).json({ message: "Erreur lors du calcul de l'avancement du projet", error: error.message });
  }
};

export const getUserProgressController = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    if (isNaN(userId) || userId <= 0)
      return res.status(400).json({ message: "userId invalide" });

    const result = await getUserProgress(userId);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ message: "Erreur lors du calcul de l'avancement utilisateur", error: error.message });
  }
};

export const getSprintProgressController = async (req: Request, res: Response) => {
  try {
    const sprintId = Number(req.params.sprintId);
    if (isNaN(sprintId) || sprintId <= 0)
      return res.status(400).json({ message: "sprintId invalide" });

    const user = (req as any).user;
    const projectId = await getProjectIdForSprint(sprintId);
    if (!projectId) {
      return res.status(400).json({ message: "sprintId invalide" });
    }
    const ctx = await getProjectPermissionContext(user, projectId);
    assertCanViewTasks(ctx);

    const result = await getSprintProgress(sprintId);
    return res.status(200).json(result);
  } catch (error: any) {
    if (mapProjectPermError(error, res)) return;
    return res.status(500).json({ message: "Erreur lors du calcul de l'avancement du sprint", error: error.message });
  }
};
