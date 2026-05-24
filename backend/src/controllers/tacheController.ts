import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";
import { userCanViewTaskInProject } from "../lib/sidebarAccessFilter";
import {
  assertCanAssignTask,
  assertCanCreateTask,
  assertCanDeleteTask,
  assertCanDeleteSubtask,
  assertCanUpdateAssignedTaskStatus,
  assertCanUpdateTask,
  assertCanViewTasks,
  canGlobalMemberUpdateOwnTaskPriority,
  getProjectIdForSprint,
  getProjectPermissionContext,
  hasProjectPermission,
  assertCanCommentOnTask,
  assertCanDeleteTaskComment,
  PERMISSION_DENIED_MESSAGE,
  serializeWorkspaceProjectAuth,
} from "../services/projectPermission.service";
import {
  commentDtoToApi,
  createTaskComment,
  deleteTaskCommentById,
  getTaskCommentById,
  getTaskComments,
  getTaskHistory,
  logTaskFieldChanges,
} from "../services/taskActivity.service";
import {
  logTaskMemberActivity,
  memberActivityActionForStatus,
} from "../services/enterpriseActivity.service";
import {
  createTaskService,
  createSubtasksForParent,
  getAllTasksService,
  getTaskByIdService,
  updateTaskService,
  deleteTaskService,
  softDeleteTaskService,
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
import { permissionSetHas } from "../lib/permissionProfiles";
import { normalizeCreateTaskPayload } from "../lib/normalizeTaskPayload";
import { isGlobalMemberUser } from "../lib/isGlobalMember";
import {
  permanentDeleteTask,
  restoreTaskFromTrash,
} from "../lib/memberTrash";

function mapProjectPermError(error: any, res: Response) {
  if (error?.status === 403 && error?.code === "PROJECT_PERMISSION_DENIED") {
    return res.status(403).json({
      message: error.message || PERMISSION_DENIED_MESSAGE,
      code: error.code,
      requiredPermission: error.requiredPermission,
    });
  }
  return null;
}

function activityUserName(user: {
  prenom?: string | null;
  nom?: string | null;
  email?: string | null;
}): string {
  const name = `${user.prenom || ""} ${user.nom || ""}`.trim();
  return name || user.email || "Membre";
}

function projectSeesAllTasks(ctx: {
  fullAccess: boolean;
  permissions: ReadonlySet<string>;
}): boolean {
  if (ctx.fullAccess) return true;
  return (
    permissionSetHas(ctx.permissions, "TASK_EDIT_ALL") ||
    permissionSetHas(ctx.permissions, "TASK_STATUS_ALL")
  );
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

    const assigneeId =
      normalized.assigne_a == null ? NaN : Number(normalized.assigne_a);
    const uid = Number(user.id);
    const memberSelfCreate =
      isGlobalMemberUser(user) &&
      Number.isFinite(uid) &&
      uid > 0 &&
      Number.isFinite(assigneeId) &&
      assigneeId === uid;

    if (memberSelfCreate) {
      const membership = await prisma.membre_projet.findFirst({
        where: { id_projet: pid, id_utilisateur: uid },
      });
      if (!membership) {
        return res.status(403).json({
          message: "Vous devez être membre du projet pour créer une tâche.",
        });
      }
    } else {
      assertCanCreateTask(ctx);

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
    }

    const resolvedAssignee =
      memberSelfCreate && Number.isFinite(uid) && uid > 0
        ? uid
        : Number.isFinite(assigneeId) && assigneeId >= 1
          ? assigneeId
          : null;

    const task = await createTaskService({
      nom_t: normalized.nom_t,
      description_t: String(normalized.description_t ?? ""),
      statut_t: normalized.statut_t as string | undefined,
      priorite_t: normalized.priorite_t as string | undefined,
      date_debut_t: normalized.date_debut_t as string | undefined,
      date_limite_t: normalized.date_limite_t as string | undefined,
      id_projet: pid,
      id_sprint: sprintId ?? undefined,
      id_list: listId,
      id_group: normalized.id_group ?? undefined,
      id_folder: normalized.id_folder ?? undefined,
      assigne_a: resolvedAssignee,
      cree_par: user.id,
      id_parent_tache: normalized.id_parent_tache ?? undefined,
    });

    const projectName =
      (task as { projet?: { nom_p?: string | null } }).projet?.nom_p?.trim() ||
      "Projet";
    const isSubtask =
      (task as { id_parent_tache?: number | null }).id_parent_tache != null;
    await logTaskMemberActivity({
      user: activityUserName(user),
      action: isSubtask ? "Sous-tâche créée" : "Tâche créée",
      projectId: pid,
      projectName,
      taskTitle: String(task.nom_t ?? normalized.nom_t ?? "Tâche"),
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
    const userId = Number(user.id);
    if (!userCanViewTaskInProject(ctx, task, userId)) {
      return res.status(403).json({
        message: "Vous n'avez pas accès à cette tâche.",
      });
    }
    const authPayload = serializeWorkspaceProjectAuth(user, ctx);
    return res.status(200).json({
      ...task,
      currentUserPermissions: authPayload.currentUserPermissions,
      currentUserProjectRole: authPayload.currentUserProjectRole,
    });
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
    });
    if (!existing?.id_projet) {
      return res.status(404).json({ message: "Tâche inexistante" });
    }
    const ctx = await getProjectPermissionContext(user, Number(existing.id_projet));
    const body = req.body as Record<string, unknown>;
    const memberOwnPriority = canGlobalMemberUpdateOwnTaskPriority(
      user,
      existing,
      body
    );
    if (!memberOwnPriority) {
      assertCanUpdateTask(ctx, existing, body, user.id);
    }

    const patchBody: Record<string, unknown> = { ...body };
    if (normalized.priorite_t != null && normalized.priorite_t !== "") {
      patchBody.priorite_t = normalized.priorite_t;
      patchBody.priority = normalized.priorite_t;
    }
    if (normalized.statut_t != null && normalized.statut_t !== "") {
      patchBody.statut_t = normalized.statut_t;
      patchBody.status = normalized.statut_t;
    }

    const task = await updateTaskService(id, patchBody as any);

    const assigneeLabels = new Map<number, string>();
    const members = await prisma.membre_projet.findMany({
      where: { id_projet: Number(existing.id_projet) },
      include: {
        utilisateur: {
          select: { id_utilisateur: true, nom: true, prenom: true, email: true },
        },
      },
    });
    for (const m of members) {
      if (!m.utilisateur) continue;
      const u = m.utilisateur;
      const label =
        `${u.prenom || ""} ${u.nom || ""}`.trim() || u.email || `#${u.id_utilisateur}`;
      assigneeLabels.set(u.id_utilisateur, label);
    }

    await logTaskFieldChanges({
      taskId: id,
      userId: Number(user.id) || null,
      before: {
        nom_t: existing.nom_t,
        description_t: existing.description_t,
        statut_t: existing.statut_t,
        priorite_t: existing.priorite_t,
        assigne_a: existing.assigne_a,
        date_debut_t: existing.date_debut_t,
        date_limite_t: existing.date_limite_t,
      },
      after: {
        nom_t: task.nom_t,
        description_t: task.description_t,
        statut_t: task.statut_t,
        priorite_t: task.priorite_t,
        assigne_a: task.assigne_a,
        date_debut_t: task.date_debut_t,
        date_limite_t: task.date_limite_t,
      },
      assigneeLabels,
    });

    const projectRow = await prisma.projet.findUnique({
      where: { id_projet: Number(existing.id_projet) },
      select: { nom_p: true },
    });
    const projectName = projectRow?.nom_p?.trim() || "Projet";
    const taskTitle = String(task.nom_t ?? existing.nom_t ?? "Tâche");
    const actor = activityUserName(user);

    if (existing.statut_t !== task.statut_t) {
      const statusAction =
        memberActivityActionForStatus(task.statut_t) ?? "Statut modifié";
      await logTaskMemberActivity({
        user: actor,
        action: statusAction,
        projectId: Number(existing.id_projet),
        projectName,
        taskTitle,
        status: statusAction === "Tâche en retard" ? "WARNING" : "ACTIVE",
      });
    }

    if (
      existing.assigne_a !== task.assigne_a &&
      task.assigne_a != null &&
      Number(task.assigne_a) > 0
    ) {
      await logTaskMemberActivity({
        user: actor,
        action: "Tâche assignée",
        projectId: Number(existing.id_projet),
        projectName,
        taskTitle,
        status: "PENDING",
      });
    }

    const authPayload = serializeWorkspaceProjectAuth(user, ctx);
    return res.status(200).json({
      message: "Tâche mise à jour",
      task: {
        ...task,
        currentUserPermissions: authPayload.currentUserPermissions,
        currentUserProjectRole: authPayload.currentUserProjectRole,
      },
    });
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
      select: {
        id_projet: true,
        id_parent_tache: true,
        assigne_a: true,
        deleted_at: true,
      },
    });
    if (!existing?.id_projet || existing.deleted_at) {
      return res.status(404).json({ message: "Tâche inexistante" });
    }
    const ctx = await getProjectPermissionContext(user, Number(existing.id_projet));
    const userId = Number(user?.id_utilisateur ?? user?.id);
    if (existing.id_parent_tache) {
      const parent = await prisma.tache.findUnique({
        where: { id_tache: existing.id_parent_tache },
        select: { assigne_a: true },
      });
      assertCanDeleteSubtask(
        ctx,
        { assigne_a: existing.assigne_a },
        userId,
        parent
      );
    } else {
      assertCanDeleteTask(ctx);
    }

    if (isGlobalMemberUser(user)) {
      await softDeleteTaskService(id, userId);
      return res.status(200).json({ message: "Tâche déplacée vers la corbeille" });
    }

    await deleteTaskService(id);
    return res.status(200).json({ message: "Tâche supprimée" });
  } catch (error: any) {
    if (mapProjectPermError(error, res)) return;
    return res.status(error.message === "Tâche inexistante" ? 404 : 500).json({ message: error.message });
  }
};

export const restoreTask = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    const user = (req as any).user;
    const existing = await prisma.tache.findUnique({
      where: { id_tache: id },
      select: {
        id_projet: true,
        deleted_at: true,
        id_parent_tache: true,
        assigne_a: true,
      },
    });
    if (!existing?.id_projet || !existing.deleted_at) {
      return res.status(404).json({ message: "Tâche introuvable dans la corbeille" });
    }
    const ctx = await getProjectPermissionContext(user, Number(existing.id_projet));
    const userId = Number(user?.id_utilisateur ?? user?.id);
    if (existing.id_parent_tache) {
      const parent = await prisma.tache.findUnique({
        where: { id_tache: existing.id_parent_tache },
        select: { assigne_a: true },
      });
      assertCanDeleteSubtask(
        ctx,
        { assigne_a: existing.assigne_a },
        userId,
        parent
      );
    } else {
      assertCanDeleteTask(ctx);
    }
    await restoreTaskFromTrash(id);
    return res.status(200).json({ message: "Tâche restaurée" });
  } catch (error: any) {
    if (mapProjectPermError(error, res)) return;
    return res.status(500).json({ message: error.message });
  }
};

export const permanentDeleteTaskController = async (
  req: Request,
  res: Response
) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    const user = (req as any).user;
    const existing = await prisma.tache.findUnique({
      where: { id_tache: id },
      select: {
        id_projet: true,
        deleted_at: true,
        id_parent_tache: true,
        assigne_a: true,
      },
    });
    if (!existing?.id_projet || !existing.deleted_at) {
      return res.status(404).json({ message: "Tâche introuvable dans la corbeille" });
    }
    const ctx = await getProjectPermissionContext(user, Number(existing.id_projet));
    const userId = Number(user?.id_utilisateur ?? user?.id);
    if (existing.id_parent_tache) {
      const parent = await prisma.tache.findUnique({
        where: { id_tache: existing.id_parent_tache },
        select: { assigne_a: true },
      });
      assertCanDeleteSubtask(
        ctx,
        { assigne_a: existing.assigne_a },
        userId,
        parent
      );
    } else {
      assertCanDeleteTask(ctx);
    }
    await permanentDeleteTask(id);
    return res.status(200).json({ message: "Tâche supprimée définitivement" });
  } catch (error: any) {
    if (mapProjectPermError(error, res)) return;
    return res.status(500).json({ message: error.message });
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
    const projectRow = await prisma.projet.findUnique({
      where: { id_projet: Number(lean.id_projet) },
      select: { nom_p: true },
    });
    await logTaskMemberActivity({
      user: activityUserName(user),
      action: "Tâche assignée",
      projectId: Number(lean.id_projet),
      projectName: projectRow?.nom_p?.trim() || "Projet",
      taskTitle: String(task.nom_t ?? "Tâche"),
      status: "PENDING",
    });
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


function authUserId(req: Request): number {
  const user = (req as any).user;
  const id = Number(user?.id ?? user?.id_utilisateur);
  if (!Number.isFinite(id) || id < 1) {
    throw Object.assign(new Error("Utilisateur non authentifié"), { status: 401 });
  }
  return id;
}

function parseTaskIdParam(req: Request): number {
  const raw = req.params.taskId ?? req.params.id;
  const id = parseInt(String(raw), 10);
  return id;
}

function extractCommentContent(body: unknown): string {
  const b = (body ?? {}) as Record<string, unknown>;
  return String(
    b.content ?? b.contenu ?? b.comment ?? b.message ?? ""
  ).trim();
}

async function assertCanAccessTask(
  user: { id: number },
  taskId: number
): Promise<{ id_projet: number; assigne_a: number | null }> {
  const lean = await prisma.tache.findUnique({
    where: { id_tache: taskId },
    select: { id_projet: true, assigne_a: true },
  });
  if (!lean?.id_projet) {
    throw Object.assign(new Error("Tâche inexistante"), { status: 404 });
  }
  const ctx = await getProjectPermissionContext(user, Number(lean.id_projet));
  assertCanViewTasks(ctx);
  if (!projectSeesAllTasks(ctx)) {
    const isAssignee = Number(lean.assigne_a) === Number(user.id);
    if (!isAssignee && !hasProjectPermission(ctx, "view_tasks")) {
      throw Object.assign(new Error("Vous n'avez pas accès à cette tâche."), {
        status: 403,
      });
    }
  }
  return {
    id_projet: Number(lean.id_projet),
    assigne_a: lean.assigne_a,
  };
}

export const postTaskSubtasksController = async (req: Request, res: Response) => {
  try {
    const taskId = parseTaskIdParam(req);
    if (isNaN(taskId) || taskId < 1) {
      return res.status(400).json({ message: "ID de tâche invalide" });
    }

    const user = (req as any).user;
    const access = await assertCanAccessTask(user, taskId);
    const ctx = await getProjectPermissionContext(user, access.id_projet);
    const uid = Number(user.id);
    if (isGlobalMemberUser(user)) {
      const membership = await prisma.membre_projet.findFirst({
        where: {
          id_projet: access.id_projet,
          id_utilisateur: uid,
        },
      });
      const isAssignee =
        access.assigne_a != null && Number(access.assigne_a) === uid;
      if (!membership && !isAssignee) {
        return res.status(403).json({
          message: "Vous ne pouvez pas ajouter de sous-tâches à cette tâche.",
        });
      }
    } else {
      assertCanCreateTask(ctx);
    }

    const rawTitles = req.body?.titles ?? req.body?.subtasks ?? req.body?.items;
    const titles = Array.isArray(rawTitles)
      ? rawTitles.map((t: unknown) => String(t ?? ""))
      : typeof rawTitles === "string"
        ? rawTitles.split("\n")
        : [];

    const created = await createSubtasksForParent(taskId, titles, {
      cree_par: user.id,
    });

    const parentRow = await prisma.tache.findUnique({
      where: { id_tache: taskId },
      select: {
        nom_t: true,
        id_projet: true,
        projet: { select: { nom_p: true } },
      },
    });
    const projectId = Number(parentRow?.id_projet);
    const projectName = parentRow?.projet?.nom_p?.trim() || "Projet";
    const actor = activityUserName(user);
    for (const sub of created) {
      await logTaskMemberActivity({
        user: actor,
        action: "Sous-tâche créée",
        projectId,
        projectName,
        taskTitle: String(sub.nom_t ?? "Sous-tâche"),
      });
    }

    return res.status(201).json({
      parentTaskId: taskId,
      subtasks: created,
    });
  } catch (error: any) {
    if (mapProjectPermError(error, res)) return;
    const status =
      error.message === "Tâche parente introuvable ou sans liste"
        ? 404
        : error.message?.includes("Aucune sous-tâche")
          ? 400
          : 500;
    return res.status(status).json({ message: error.message });
  }
};

export const getTaskCommentsController = async (req: Request, res: Response) => {
  try {
    const id = parseTaskIdParam(req);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ message: "ID de tâche invalide" });
    }
    const user = (req as any).user;
    await assertCanAccessTask(user, id);
    const comments = await getTaskComments(id);
    return res.status(200).json(comments.map(commentDtoToApi));
  } catch (error: any) {
    if (mapProjectPermError(error, res)) return;
    console.error("[getTaskComments]", error);
    const status = error?.status === 404 ? 404 : error?.status === 403 ? 403 : 500;
    return res.status(status).json({ message: error.message });
  }
};

export const postTaskCommentController = async (req: Request, res: Response) => {
  try {
    const taskId = parseTaskIdParam(req);
    if (isNaN(taskId) || taskId < 1) {
      return res.status(400).json({ message: "ID de tâche invalide" });
    }

    const userId = authUserId(req);
    const content = extractCommentContent(req.body);
    if (!content) {
      return res.status(400).json({
        message: "Le commentaire ne peut pas être vide",
      });
    }

    const task = await prisma.tache.findUnique({
      where: { id_tache: taskId },
      select: { id_tache: true, id_projet: true, assigne_a: true },
    });
    if (!task) {
      return res.status(404).json({ message: "Tâche inexistante" });
    }
    if (!task.id_projet) {
      return res.status(400).json({ message: "Tâche sans projet associé" });
    }

    const dbUser = await prisma.utilisateur.findUnique({
      where: { id_utilisateur: userId },
      select: { id_utilisateur: true },
    });
    if (!dbUser) {
      return res.status(401).json({ message: "Utilisateur introuvable" });
    }

    const user = (req as any).user;
    try {
      const access = await assertCanAccessTask(user, taskId);
      const ctx = await getProjectPermissionContext(user, access.id_projet);
      await assertCanCommentOnTask(
        ctx,
        userId,
        { assigne_a: task.assigne_a },
        Number(task.id_projet)
      );
    } catch (permErr: any) {
      const membership = await prisma.membre_projet.findFirst({
        where: {
          id_projet: Number(task.id_projet),
          id_utilisateur: userId,
        },
      });
      const isAssignee =
        task.assigne_a != null && Number(task.assigne_a) === userId;
      if (!membership && !isAssignee) {
        if (mapProjectPermError(permErr, res)) return;
        return res.status(403).json({
          message:
            permErr?.message ||
            "Vous ne pouvez pas commenter cette tâche.",
        });
      }
    }

    const dto = await createTaskComment(taskId, userId, content);

    const taskMeta = await prisma.tache.findUnique({
      where: { id_tache: taskId },
      select: {
        nom_t: true,
        id_projet: true,
        projet: { select: { nom_p: true } },
      },
    });
    if (taskMeta?.id_projet) {
      const commentAuthor = await prisma.utilisateur.findUnique({
        where: { id_utilisateur: userId },
        select: { prenom: true, nom: true, email: true },
      });
      await logTaskMemberActivity({
        user: activityUserName(commentAuthor ?? user),
        action: "Commentaire ajouté",
        projectId: Number(taskMeta.id_projet),
        projectName: taskMeta.projet?.nom_p?.trim() || "Projet",
        taskTitle: taskMeta.nom_t?.trim() || "Tâche",
      });
    }

    return res.status(201).json(commentDtoToApi(dto));
  } catch (error: any) {
    if (mapProjectPermError(error, res)) return;
    console.error("[postTaskComment] FULL ERROR:", error?.message, error);
    const status =
      error?.status === 401
        ? 401
        : error?.status === 403
          ? 403
          : error.message === "Tâche inexistante"
            ? 404
            : error.message?.includes("vide") ||
                error.message?.includes("obligatoire")
              ? 400
              : 500;
    return res.status(status).json({
      message: error.message || String(error),
    });
  }
};

export const deleteTaskCommentController = async (req: Request, res: Response) => {
  try {
    const commentId = parseInt(String(req.params.commentId), 10);
    if (!Number.isFinite(commentId) || commentId < 1) {
      return res.status(400).json({ message: "ID de commentaire invalide" });
    }

    const userId = authUserId(req);
    const user = (req as any).user;

    const comment = await getTaskCommentById(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Commentaire introuvable" });
    }
    if (!comment.id_projet) {
      return res.status(400).json({ message: "Tâche sans projet associé" });
    }

    await assertCanAccessTask(user, comment.id_tache);
    const ctx = await getProjectPermissionContext(user, Number(comment.id_projet));
    assertCanDeleteTaskComment(
      ctx,
      userId,
      comment.utilisateur.id_utilisateur
    );

    const deleted = await deleteTaskCommentById(commentId);
    if (!deleted) {
      return res.status(404).json({ message: "Commentaire introuvable" });
    }

    return res.status(204).send();
  } catch (error: any) {
    if (mapProjectPermError(error, res)) return;
    const status =
      error?.status === 403 ? 403 : error?.status === 404 ? 404 : 500;
    return res.status(status).json({
      message: error.message || "Impossible de supprimer le commentaire",
    });
  }
};

export const getTaskHistoryController = async (req: Request, res: Response) => {
  try {
    const id = parseTaskIdParam(req);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ message: "ID de tâche invalide" });
    }
    const user = (req as any).user;
    await assertCanAccessTask(user, id);
    const history = await getTaskHistory(id);
    return res.status(200).json(history);
  } catch (error: any) {
    if (mapProjectPermError(error, res)) return;
    const status = error?.status === 404 ? 404 : error?.status === 403 ? 403 : 500;
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
