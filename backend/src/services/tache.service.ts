import { TaskPriority } from "@prisma/client";
import prisma from "../prisma/prismaClient";
import {
  normalizeStatutKey,
  resolveWorkflowStatut,
  syncOverdueForTasks,
} from "../lib/taskStatutWorkflow";
import {
  computeProjectTaskStats,
  buildProjectTasksWhere,
  loadProjectHierarchyIndex,
} from "../lib/projectTaskStats";

const STATUTS_VALIDES = [
  "todo",
  "todo_open",
  "en_cours",
  "en_retard",
  "terminee",
  "bloquee",
  "en_revision",
] as const;
const STATUS_ALIASES: Record<string, (typeof STATUTS_VALIDES)[number]> = {
  TODO: "todo",
  TO_DO: "todo",
  todo: "todo",
  "À_FAIRE": "todo",
  "À faire": "todo",
  "à faire": "todo",
  A_FAIRE: "todo",
  TODO_OPEN: "todo_open",
  todo_open: "todo_open",
  EN_COURS: "en_cours",
  IN_PROGRESS: "en_cours",
  in_progress: "en_cours",
  EN_RETARD: "en_retard",
  en_retard: "en_retard",
  OVERDUE: "en_retard",
  TERMINEE: "terminee",
  ACHEVE: "terminee",
  ACHEVÉ: "terminee",
  DONE: "terminee",
  done: "terminee",
  TERMINE: "terminee",
  BLOQUEE: "bloquee",
  bloquee: "bloquee",
  BLOCKED: "bloquee",
  EN_REVISION: "en_revision",
  en_revision: "en_revision",
  REVIEW: "en_revision",
};

const PRIORITY_ALIASES: Record<string, TaskPriority> = {
  LOW: TaskPriority.LOW,
  BASSE: TaskPriority.LOW,
  MEDIUM: TaskPriority.MEDIUM,
  MOYENNE: TaskPriority.MEDIUM,
  HIGH: TaskPriority.HIGH,
  HAUTE: TaskPriority.HIGH,
  URGENT: TaskPriority.URGENT,
  URGENTE: TaskPriority.URGENT,
  CRITICAL: TaskPriority.URGENT,
  CRITIQUE: TaskPriority.URGENT,
};

const normalizeStatus = (statut?: string | null) => {
  if (!statut) return undefined;
  const key = String(statut).trim();
  const direct = STATUS_ALIASES[key] ?? STATUS_ALIASES[key.toUpperCase()];
  if (direct) return direct;
  const slug = normalizeStatutKey(key);
  if (STATUTS_VALIDES.includes(slug as (typeof STATUTS_VALIDES)[number])) {
    return slug as (typeof STATUTS_VALIDES)[number];
  }
  if (/^[a-z][a-z0-9_]{0,48}$/i.test(slug)) {
    return slug;
  }
  throw new Error("Statut invalide");
};

function applyWorkflowToUpdate(
  existing: { statut_t: string | null; date_limite_t: Date | null },
  patch: { statut_t?: string; date_limite_t?: string | null },
  userExplicitStatut: boolean
): string | undefined {
  const nextDate =
    patch.date_limite_t !== undefined
      ? patch.date_limite_t === null || patch.date_limite_t === ""
        ? null
        : new Date(patch.date_limite_t)
      : existing.date_limite_t;

  const requested =
    patch.statut_t !== undefined ? normalizeStatus(patch.statut_t) : undefined;

  return resolveWorkflowStatut(
    existing.statut_t,
    nextDate,
    requested,
    { userExplicitStatut }
  );
}

const normalizePriority = (priorite?: string | null): TaskPriority | undefined => {
  if (!priorite) return undefined;
  const normalized = PRIORITY_ALIASES[String(priorite).trim().toUpperCase()];
  if (!normalized) {
    throw new Error("Priorité invalide");
  }
  return normalized;
};

export async function assertUserIsProjectMember(
  id_projet: number,
  userId: number
): Promise<void> {
  const m = await prisma.membre_projet.findFirst({
    where: {
      id_projet: Number(id_projet),
      id_utilisateur: Number(userId),
    },
    select: { id_membre_projet: true },
  });
  if (!m) {
    throw new Error("L'utilisateur assigné n'est pas membre de ce projet");
  }
}

async function withAssigneeProjectRoles(id_projet: number, tasks: any[]) {
  const members = await prisma.membre_projet.findMany({
    where: { id_projet: Number(id_projet) },
    select: { id_utilisateur: true, role_projet: true },
  });
  const map = new Map(
    members.map((m) => [
      m.id_utilisateur,
      (m.role_projet ?? "").trim() || "Membre",
    ])
  );
  return tasks.map((t) => ({
    ...t,
    assignee_project_role:
      t.assigne_a != null ? map.get(Number(t.assigne_a)) ?? null : null,
  }));
}

interface CreateTaskData {
  nom_t: string;
  description_t?: string;
  date_debut_t?: string;
  date_limite_t?: string;
  priorite_t?: string;
  statut_t?: string;
  id_projet: number;
  id_group?: number;
  id_folder?: number;
  id_sprint?: number;
  id_list?: number;
  assigne_a?: number | null;
  cree_par?: number | null;
  id_parent_tache?: number | null;
}

interface UpdateTaskData {
  nom_t?: string;
  description_t?: string;
  date_debut_t?: string | null;
  date_limite_t?: string;
  priorite_t?: string;
  statut_t?: string;
  id_projet?: number;
  id_group?: number | null;
  id_folder?: number | null;
  id_sprint?: number | null;
  id_list?: number | null;
  assigne_a?: number | null;
}

const db = prisma as any;

export const DEFAULT_LIST_NAME = "Liste par défaut";

/** Ensures every sprint has a list; returns list id for task placement. */
export async function ensureDefaultListForSprint(
  id_projet: number,
  id_sprint: number
): Promise<number> {
  const existingDefault = await db.list_pm.findFirst({
    where: {
      id_projet,
      id_sprint,
      nom: DEFAULT_LIST_NAME,
    },
    select: { id_list: true },
  });
  if (existingDefault) return existingDefault.id_list;

  const anyInSprint = await db.list_pm.findFirst({
    where: { id_projet, id_sprint },
    orderBy: [{ position: "asc" }, { id_list: "asc" }],
    select: { id_list: true },
  });
  if (anyInSprint) return anyInSprint.id_list;

  const created = await db.list_pm.create({
    data: {
      nom: DEFAULT_LIST_NAME,
      id_projet,
      id_sprint,
      position: 0,
    },
    select: { id_list: true },
  });
  return created.id_list;
}

/** Resolve sprint/list ids: sprint without list → default list; list without sprint → inherit from list. */
export async function resolveTaskHierarchyIds(input: {
  id_projet: number;
  id_sprint?: number | null;
  id_list?: number | null;
}): Promise<{ id_sprint: number | null; id_list: number | null }> {
  const projectId = Number(input.id_projet);
  let sprintId =
    input.id_sprint != null && Number(input.id_sprint) > 0
      ? Number(input.id_sprint)
      : null;
  let listId =
    input.id_list != null && Number(input.id_list) > 0
      ? Number(input.id_list)
      : null;

  if (listId) {
    const list = await db.list_pm.findUnique({
      where: { id_list: listId },
      select: { id_projet: true, id_sprint: true },
    });
    if (!list || list.id_projet !== projectId) {
      throw new Error("La liste n'appartient pas à ce projet");
    }
    if (!sprintId && list.id_sprint) {
      sprintId = list.id_sprint;
    }
  }

  if (sprintId && !listId) {
    listId = await ensureDefaultListForSprint(projectId, sprintId);
  }

  return { id_sprint: sprintId, id_list: listId };
}

const validateHierarchyAncestors = async (input: {
  id_projet: number;
  id_group?: number | null;
  id_folder?: number | null;
  id_sprint?: number | null;
  id_list?: number | null;
}) => {
  const { id_projet, id_group, id_folder, id_sprint, id_list } = input;

  if (id_group) {
    const group = await db.group_pm.findUnique({ where: { id_group: Number(id_group) } });
    if (!group || group.id_projet !== Number(id_projet)) {
      throw new Error("Le groupe n'appartient pas à ce projet");
    }
  }

  if (id_folder) {
    const folder = await db.folder_pm.findUnique({ where: { id_folder: Number(id_folder) } });
    if (!folder || folder.id_projet !== Number(id_projet)) {
      throw new Error("Le dossier n'appartient pas à ce projet");
    }
    if (id_group && folder.id_group && folder.id_group !== Number(id_group)) {
      throw new Error("Le dossier n'appartient pas à ce groupe");
    }
  }

  if (id_sprint) {
    const sprint = await prisma.sprint.findUnique({
      where: { id_sprint: Number(id_sprint) }
    });
    if (!sprint || sprint.id_projet !== Number(id_projet)) {
      throw new Error("Le sprint n'appartient pas à ce projet");
    }
    if (id_group && (sprint as any).id_group && (sprint as any).id_group !== Number(id_group)) {
      throw new Error("Le sprint n'appartient pas à ce groupe");
    }
    if (id_folder && (sprint as any).id_folder && (sprint as any).id_folder !== Number(id_folder)) {
      throw new Error("Le sprint n'appartient pas à ce dossier");
    }
  }

  if (id_list) {
    const list = await db.list_pm.findUnique({ where: { id_list: Number(id_list) } });
    if (!list || list.id_projet !== Number(id_projet)) {
      throw new Error("La liste n'appartient pas à ce projet");
    }
    if (id_group && list.id_group && list.id_group !== Number(id_group)) {
      throw new Error("La liste n'appartient pas à ce groupe");
    }
    if (id_folder && list.id_folder && list.id_folder !== Number(id_folder)) {
      throw new Error("La liste n'appartient pas à ce dossier");
    }
    if (id_sprint && list.id_sprint && list.id_sprint !== Number(id_sprint)) {
      throw new Error("La liste n'appartient pas à ce sprint");
    }
  }
};

export const createTaskService = async (data: CreateTaskData) => {
  const {
    nom_t,
    description_t,
    date_debut_t,
    date_limite_t,
    priorite_t,
    id_projet,
    statut_t,
    id_group,
    id_folder,
    id_sprint,
    id_list,
    assigne_a,
  } = data;

  const normalizedPriority =
    normalizePriority(priorite_t ?? (data as any).priorite) ?? TaskPriority.MEDIUM;
  const normalizedStatus = normalizeStatus(statut_t) ?? "todo";
  const dueForWorkflow = date_limite_t ? new Date(date_limite_t) : null;
  const workflowStatus = resolveWorkflowStatut(
    null,
    dueForWorkflow,
    normalizedStatus,
    { userExplicitStatut: statut_t != null && String(statut_t).trim() !== "" }
  );
  if (!nom_t) {
    throw new Error("nom_t est obligatoire");
  }

  const parentId =
    data.id_parent_tache != null && Number(data.id_parent_tache) > 0
      ? Number(data.id_parent_tache)
      : null;

  let projectId = Number(id_projet);
  let listId =
    id_list != null && Number(id_list) > 0 ? Number(id_list) : null;
  let sprintId =
    id_sprint != null && Number(id_sprint) > 0 ? Number(id_sprint) : null;
  let groupId = id_group ? Number(id_group) : null;
  let folderId = id_folder ? Number(id_folder) : null;

  if (parentId) {
    const parent = await prisma.tache.findUnique({
      where: { id_tache: parentId },
      select: {
        id_tache: true,
        id_projet: true,
        id_list: true,
        id_sprint: true,
        id_group: true,
        id_folder: true,
        assigne_a: true,
        priorite_t: true,
        date_limite_t: true,
      },
    });
    if (!parent?.id_projet) {
      throw new Error("Tâche parente introuvable");
    }
    projectId = Number(parent.id_projet);
    listId = parent.id_list != null ? Number(parent.id_list) : listId;
    sprintId =
      parent.id_sprint != null ? Number(parent.id_sprint) : sprintId;
    groupId = parent.id_group != null ? Number(parent.id_group) : groupId;
    folderId = parent.id_folder != null ? Number(parent.id_folder) : folderId;
  }

  if (listId && (!Number.isFinite(projectId) || projectId < 1)) {
    const listRow = await db.list_pm.findUnique({
      where: { id_list: listId },
      select: { id_projet: true, id_sprint: true },
    });
    if (!listRow) {
      throw new Error("Liste introuvable");
    }
    projectId = Number(listRow.id_projet);
    if (!sprintId && listRow.id_sprint) {
      sprintId = Number(listRow.id_sprint);
    }
  }

  if (!listId) {
    throw new Error("listId est obligatoire");
  }

  if (parentId && parentId === Number((data as any).id_tache)) {
    throw new Error("Une tâche ne peut pas être sa propre sous-tâche");
  }

  if (!Number.isFinite(projectId) || projectId < 1) {
    throw new Error("id_projet est obligatoire");
  }

  const projet = await prisma.projet.findUnique({
    where: { id_projet: projectId },
  });

  if (!projet) {
    throw new Error("Projet inexistant");
  }

  const resolved = await resolveTaskHierarchyIds({
    id_projet: projectId,
    id_sprint: sprintId,
    id_list: listId,
  });

  await validateHierarchyAncestors({
    id_projet: projectId,
    id_group: groupId,
    id_folder: folderId,
    id_sprint: resolved.id_sprint,
    id_list: resolved.id_list,
  });

  const assigneeId =
    assigne_a === undefined || assigne_a === null ? null : Number(assigne_a);
  if (assigneeId !== null) {
    const assignee = await prisma.utilisateur.findUnique({
      where: { id_utilisateur: assigneeId },
      select: { id_utilisateur: true },
    });
    if (!assignee) {
      throw new Error("Utilisateur inexistant");
    }
    await assertUserIsProjectMember(projectId, assigneeId);
  }

  const creatorId =
    (data as any).cree_par === undefined || (data as any).cree_par === null
      ? null
      : Number((data as any).cree_par);

  const task = await prisma.tache.create({
    data: {
      nom_t,
      description_t,
      date_debut_t: date_debut_t ? new Date(date_debut_t) : null,
      date_limite_t: date_limite_t ? new Date(date_limite_t) : null,
      priorite_t: normalizedPriority,
      statut_t: workflowStatus,
      id_projet: projectId,
      id_group: groupId,
      id_folder: folderId,
      id_sprint: resolved.id_sprint,
      id_list: resolved.id_list,
      id_parent_tache: parentId,
      assigne_a: assigneeId,
      cree_par: creatorId && Number.isFinite(creatorId) ? creatorId : null,
    },

    include: {
      utilisateur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          poste: true
        }
      },
      createur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
        }
      },
      projet: true,
      sprint: true,
      group_pm: true,
      folder_pm: true,
      list_pm: true
    }
  });

  const [enriched] = await withAssigneeProjectRoles(Number(id_projet), [task]);
  return enriched;
};

export async function createSubtasksForParent(
  parentTaskId: number,
  titles: string[],
  options?: { cree_par?: number | null; assigne_a?: number | null }
): Promise<any[]> {
  const parent = await prisma.tache.findUnique({
    where: { id_tache: parentTaskId },
  });
  if (!parent?.id_projet || !parent.id_list) {
    throw new Error("Tâche parente introuvable ou sans liste");
  }

  const cleaned = titles
    .map((t) => String(t ?? "").trim())
    .filter((t) => t.length > 0)
    .slice(0, 12);

  if (cleaned.length === 0) {
    throw new Error("Aucune sous-tâche valide");
  }

  const created: any[] = [];
  for (const nom_t of cleaned) {
    const row = await createTaskService({
      nom_t,
      description_t: "",
      statut_t: "todo",
      priorite_t: parent.priorite_t ?? undefined,
      date_limite_t: parent.date_limite_t
        ? new Date(parent.date_limite_t).toISOString().slice(0, 10)
        : undefined,
      id_projet: Number(parent.id_projet),
      id_sprint: parent.id_sprint ?? undefined,
      id_list: Number(parent.id_list),
      id_group: parent.id_group ?? undefined,
      id_folder: parent.id_folder ?? undefined,
      id_parent_tache: parentTaskId,
      assigne_a:
        options?.assigne_a !== undefined
          ? options.assigne_a
          : parent.assigne_a ?? null,
      cree_par: options?.cree_par ?? null,
    });
    created.push(row);
  }
  return created;
}

export const getAllTasksService = async () => {
  return await prisma.tache.findMany({
    include: {
      utilisateur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          poste: true
        }
      },
      projet: true,
      sprint: true
    }
  });
};

export const getTaskByIdService = async (id: number) => {
  const task = await prisma.tache.findUnique({
    where: { id_tache: id },
    include: {
      utilisateur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          poste: true
        }
      },
      createur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
        }
      },
      projet: true,
      sprint: true,
      subtasks: {
        where: { deleted_at: null },
        orderBy: { id_tache: "asc" },
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
      },
    }
  });

  if (!task || !task.id_projet || task.deleted_at) {
    throw new Error("Tâche inexistante");
  }

  const allRows = [task, ...(task.subtasks ?? [])];
  const synced = await syncOverdueForTasks(allRows);
  const syncedParent =
    synced.find((t) => t.id_tache === task.id_tache) ?? synced[0];
  const syncedSubs = synced.filter((t) => t.id_tache !== task.id_tache);
  const [enrichedParent] = await withAssigneeProjectRoles(
    Number(task.id_projet),
    [syncedParent]
  );
  const enrichedSubs = await withAssigneeProjectRoles(
    Number(task.id_projet),
    syncedSubs
  );
  return { ...enrichedParent, subtasks: enrichedSubs };
};

export const updateTaskService = async (id: number, data: UpdateTaskData) => {
  const existingTask = await prisma.tache.findUnique({
    where: { id_tache: id }
  });
  if (!existingTask) {
    throw new Error("Tâche inexistante");
  }
  const statutInput =
    data.statut_t !== undefined
      ? data.statut_t
      : (data as { status?: string }).status;
  const userExplicitStatut = statutInput !== undefined;
  const workflowStatut =
    statutInput !== undefined || data.date_limite_t !== undefined
      ? applyWorkflowToUpdate(
          {
            statut_t: existingTask.statut_t,
            date_limite_t: existingTask.date_limite_t,
          },
          {
            statut_t: statutInput as string | undefined,
            date_limite_t: data.date_limite_t,
          },
          userExplicitStatut
        )
      : undefined;
  const normalizedPriorityInput = data.priorite_t ?? (data as any).priorite;
  const normalizedPriority =
    normalizedPriorityInput !== undefined
      ? normalizePriority(normalizedPriorityInput)
      : undefined;

  if (data.id_projet) {
    const projet = await prisma.projet.findUnique({
      where: { id_projet: Number(data.id_projet) }
    });

    if (!projet) {
      throw new Error("Projet inexistant");
    }
  }

  const projetId = Number(data.id_projet ?? existingTask.id_projet);
  if (data.assigne_a !== undefined && data.assigne_a !== null) {
    await assertUserIsProjectMember(projetId, Number(data.assigne_a));
  }

  await validateHierarchyAncestors({
    id_projet: projetId,
    id_group:
      data.id_group === null
        ? null
        : data.id_group !== undefined
          ? Number(data.id_group)
          : (existingTask as any).id_group,
    id_folder:
      data.id_folder === null
        ? null
        : data.id_folder !== undefined
          ? Number(data.id_folder)
          : (existingTask as any).id_folder,
    id_sprint:
      data.id_sprint === null
        ? null
        : data.id_sprint !== undefined
          ? Number(data.id_sprint)
          : existingTask.id_sprint,
    id_list:
      data.id_list === null
        ? null
        : data.id_list !== undefined
          ? Number(data.id_list)
          : (existingTask as any).id_list,
  });

  const task = await prisma.tache.update({
    where: { id_tache: id },
    data: {
      nom_t: data.nom_t,
      description_t: data.description_t,
      date_debut_t:
        data.date_debut_t === null
          ? null
          : data.date_debut_t
            ? new Date(data.date_debut_t)
            : undefined,
      date_limite_t:
        data.date_limite_t === null
          ? null
          : data.date_limite_t
            ? new Date(data.date_limite_t)
            : undefined,
      priorite_t: normalizedPriority,
      statut_t: workflowStatut,
      date_fin_t:
        workflowStatut === "terminee"
          ? new Date()
          : workflowStatut !== undefined && workflowStatut !== "terminee"
            ? null
            : undefined,
      id_projet: data.id_projet ? Number(data.id_projet) : undefined,
      id_group:
        data.id_group === null
          ? null
          : data.id_group
            ? Number(data.id_group)
            : undefined,
      id_folder:
        data.id_folder === null
          ? null
          : data.id_folder
            ? Number(data.id_folder)
            : undefined,
      id_sprint:
        data.id_sprint === null
          ? null
          : data.id_sprint
            ? Number(data.id_sprint)
            : undefined,
      id_list:
        data.id_list === null
          ? null
          : data.id_list
            ? Number(data.id_list)
            : undefined,
      assigne_a:
        data.assigne_a === null
          ? null
          : data.assigne_a
            ? Number(data.assigne_a)
            : undefined
    },
    include: {
      utilisateur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          poste: true
        }
      },
      createur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
        }
      },
      projet: true,
      sprint: true,
      group_pm: true,
      folder_pm: true,
      list_pm: true
    }
  });

  const [enriched] = await withAssigneeProjectRoles(
    Number(task.id_projet ?? projetId),
    [task]
  );
  return enriched;
};

export const softDeleteTaskService = async (
  id: number,
  deletedBy: number
) => {
  const existingTask = await prisma.tache.findUnique({
    where: { id_tache: id },
    select: { id_tache: true, deleted_at: true },
  });

  if (!existingTask || existingTask.deleted_at) {
    throw new Error("Tâche inexistante");
  }

  const { moveTaskToTrash } = await import("../lib/memberTrash");
  await moveTaskToTrash(id, deletedBy);
  return true;
};

export const deleteTaskService = async (id: number) => {
  const existingTask = await prisma.tache.findUnique({
    where: { id_tache: id },
    select: { id_tache: true, deleted_at: true },
  });

  if (!existingTask) {
    throw new Error("Tâche inexistante");
  }

  if (existingTask.deleted_at) {
    await prisma.tache.deleteMany({
      where: { id_parent_tache: id },
    });
    await prisma.tache.delete({ where: { id_tache: id } });
    return true;
  }

  await prisma.tache.delete({
    where: { id_tache: id },
  });

  return true;
};
export const assignTaskService = async (id_tache: number, id_utilisateur: number) => {
  const task = await prisma.tache.findUnique({
    where: { id_tache },
    include: {
      projet: true,
      sprint: true,
      utilisateur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          poste: true
        }
      }
    }
  });

  if (!task) {
    throw new Error("Tâche inexistante");
  }

  if (!task.id_projet) {
    throw new Error("Cette tâche n'est liée à aucun projet");
  }

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id_utilisateur: Number(id_utilisateur) }
  });

  if (!utilisateur) {
    throw new Error("Utilisateur inexistant");
  }

  const membreProjet = await prisma.membre_projet.findFirst({
    where: {
      id_projet: task.id_projet,
      id_utilisateur: Number(id_utilisateur),
    },
  });

  if (!membreProjet) {
    throw new Error("L'utilisateur n'est pas membre de ce projet");
  }

  const taskUpdated = await prisma.tache.update({
    where: { id_tache },
    data: {
      assigne_a: Number(id_utilisateur)
    },
    include: {
      utilisateur: true,
      createur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
        }
      },
      projet: true,
      sprint: true
    }
  });

  await prisma.affectation.create({
    data: {
      id_utilisateur: Number(id_utilisateur),
      id_projet: task.id_projet,
      id_tache: task.id_tache,
      role_affectation: "ASSIGNE"
    }
  });

  const [enriched] = await withAssigneeProjectRoles(
    Number(task.id_projet),
    [taskUpdated]
  );
  return enriched;
};
export const getTasksByProjectService = async (
  id_projet: number,
  opts?: { restrictToAssigneeId?: number }
) => {
  const projet = await prisma.projet.findUnique({
    where: { id_projet }
  });

  if (!projet) {
    throw new Error("Projet inexistant");
  }

  const where: { id_projet: number; assigne_a?: number; deleted_at: null } = {
    id_projet,
    deleted_at: null,
  };
  if (opts?.restrictToAssigneeId != null) {
    where.assigne_a = opts.restrictToAssigneeId;
  }

  const tasks = await prisma.tache.findMany({
    where,
    include: {
      utilisateur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          poste: true
        }
      },
      createur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
        }
      },
      projet: true,
      sprint: true
    },
    orderBy: {
      id_tache: "desc"
    }
  });

  const synced = await syncOverdueForTasks(tasks);
  return withAssigneeProjectRoles(id_projet, synced);
};
export const getTasksBySprintService = async (
  id_sprint: number,
  opts?: { restrictToAssigneeId?: number }
) => {
  const sprint = await prisma.sprint.findUnique({
    where: { id_sprint }
  });

  if (!sprint || sprint.id_projet == null || sprint.deleted_at) {
    throw new Error("Sprint inexistant");
  }

  const pid = Number(sprint.id_projet);
  const where: { id_sprint: number; assigne_a?: number; deleted_at: null } = {
    id_sprint,
    deleted_at: null,
  };
  if (opts?.restrictToAssigneeId != null) {
    where.assigne_a = opts.restrictToAssigneeId;
  }

  const tasks = await prisma.tache.findMany({
    where,
    include: {
      utilisateur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          poste: true
        }
      },
      createur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
        }
      },
      projet: true,
      sprint: true
    },
    orderBy: {
      id_tache: "desc"
    }
  });

  const synced = await syncOverdueForTasks(tasks);
  return withAssigneeProjectRoles(pid, synced);
};
export const getMyTasksService = async (userId: number) => {
  const tasks = await prisma.tache.findMany({
    where: {
      assigne_a: userId,
      deleted_at: null,
    },
    include: {
      utilisateur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          poste: true
        }
      },
      createur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true
        }
      },
      projet: true,
      sprint: true
    },
    orderBy: {
      id_tache: "desc"
    }
  });
  return syncOverdueForTasks(tasks);
};
export const updateMyTaskStatusService = async (
  id_tache: number,
  userId: number,
  statut_t: string
) => {
  const task = await prisma.tache.findUnique({
    where: { id_tache }
  });

  if (!task) {
    throw new Error("Tâche inexistante");
  }

  if (task.assigne_a !== userId) {
    throw new Error("Cette tâche ne vous est pas assignée");
  }

  const workflowStatus = resolveWorkflowStatut(
    task.statut_t,
    task.date_limite_t,
    normalizeStatus(statut_t),
    { userExplicitStatut: true }
  );

  const updatedTask = await prisma.tache.update({
    where: { id_tache },
    data: {
      statut_t: workflowStatus,
      date_fin_t: workflowStatus === "terminee" ? new Date() : null
    },
    include: {
      utilisateur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          poste: true
        }
      },
      projet: true,
      sprint: true
    }
  });

  return updatedTask;
};


export const getProjectProgress = async (projectId: number) => {
  const projet = await prisma.projet.findUnique({ where: { id_projet: projectId } });
  if (!projet) throw new Error("Projet inexistant");

  const { totalTasks, completedTasks, avancement } =
    await computeProjectTaskStats(projectId);

  const index = await loadProjectHierarchyIndex([projectId]);
  const where = buildProjectTasksWhere(
    [projectId],
    index.allSprintIds,
    index.allListIds
  );
  const tasks = await prisma.tache.findMany({
    where,
    select: { statut_t: true },
  });

  let inProgress = 0;
  let todo = 0;
  for (const task of tasks) {
    const key = normalizeStatutKey(task.statut_t);
    if (key === "en_cours" || key === "en_retard") inProgress += 1;
    else if (key === "todo") todo += 1;
  }

  return {
    id_projet: projectId,
    nom_p: projet.nom_p,
    total: totalTasks,
    done: completedTasks,
    inProgress,
    todo,
    progressPercent: avancement,
  };
};

export const getUserProgress = async (userId: number) => {
  const utilisateur = await prisma.utilisateur.findUnique({ where: { id_utilisateur: userId } });
  if (!utilisateur) throw new Error("Utilisateur inexistant");

  const total = await prisma.tache.count({ where: { assigne_a: userId } });
  const done = await prisma.tache.count({ where: { assigne_a: userId, statut_t: "terminee" } });
  const inProgress = await prisma.tache.count({ where: { assigne_a: userId, statut_t: "en_cours" } });
  const todo = await prisma.tache.count({ where: { assigne_a: userId, statut_t: "todo" } });

  return {
    id_utilisateur: userId,
    nom: utilisateur.nom,
    prenom: utilisateur.prenom,
    total,
    done,
    inProgress,
    todo,
    progressPercent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
};

export const getSprintProgress = async (sprintId: number) => {
  const sprint = await prisma.sprint.findUnique({ where: { id_sprint: sprintId } });
  if (!sprint) throw new Error("Sprint inexistant");

  const total = await prisma.tache.count({ where: { id_sprint: sprintId } });
  const done = await prisma.tache.count({ where: { id_sprint: sprintId, statut_t: "terminee" } });
  const inProgress = await prisma.tache.count({ where: { id_sprint: sprintId, statut_t: "en_cours" } });
  const todo = await prisma.tache.count({ where: { id_sprint: sprintId, statut_t: "todo" } });

  return {
    id_sprint: sprintId,
    nom_s: sprint.nom_s,
    total,
    done,
    inProgress,
    todo,
    progressPercent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
};
