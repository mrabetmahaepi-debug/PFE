import { Prisma } from "@prisma/client";
import prisma from "../prisma/prismaClient";
import {
  isCompletedStatut,
  isPastDueDate,
  normalizeStatutKey,
} from "./taskStatutWorkflow";

export type ProjectTaskStats = {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  lateTasks: number;
  todoTasks: number;
  avancement: number;
};

const EMPTY_STATS: ProjectTaskStats = {
  totalTasks: 0,
  completedTasks: 0,
  inProgressTasks: 0,
  lateTasks: 0,
  todoTasks: 0,
  avancement: 0,
};

type TaskPick = {
  id_tache: number;
  statut_t: string | null;
  date_limite_t: Date | null;
};

function emptyBucket(): ProjectTaskStats {
  return { ...EMPTY_STATS };
}

function tallyTask(bucket: ProjectTaskStats, task: TaskPick): void {
  bucket.totalTasks += 1;
  const key = normalizeStatutKey(task.statut_t);
  if (isCompletedStatut(task.statut_t)) {
    bucket.completedTasks += 1;
    return;
  }
  if (key === "en_cours") {
    bucket.inProgressTasks += 1;
    return;
  }
  if (
    key === "en_retard" ||
    isPastDueDate(task.date_limite_t)
  ) {
    bucket.lateTasks += 1;
    return;
  }
  bucket.todoTasks += 1;
}

function finalizeBucket(bucket: ProjectTaskStats): ProjectTaskStats {
  bucket.avancement =
    bucket.totalTasks > 0
      ? Math.round((bucket.completedTasks / bucket.totalTasks) * 100)
      : 0;
  return bucket;
}

/** Collect unique tasks from project → sprints → lists → tasks (and orphan lists). */
function collectTasksFromHierarchy(project: {
  id_projet: number;
  sprint: {
    list_pm: { tache: TaskPick[] }[];
  }[];
  list_pm: { tache: TaskPick[] }[];
}): TaskPick[] {
  const byId = new Map<number, TaskPick>();

  const add = (task: TaskPick) => {
    if (!byId.has(task.id_tache)) byId.set(task.id_tache, task);
  };

  for (const sprint of project.sprint ?? []) {
    for (const list of sprint.list_pm ?? []) {
      for (const task of list.tache ?? []) add(task);
    }
  }
  for (const list of project.list_pm ?? []) {
    for (const task of list.tache ?? []) add(task);
  }

  return [...byId.values()];
}

async function loadProjectsHierarchy(projectIds: number[]) {
  if (!projectIds.length) return [];

  return prisma.projet.findMany({
    where: { id_projet: { in: projectIds } },
    select: {
      id_projet: true,
      sprint: {
        where: { deleted_at: null },
        select: {
          list_pm: {
            where: { deleted_at: null },
            select: {
              tache: {
                where: { deleted_at: null },
                select: {
                  id_tache: true,
                  statut_t: true,
                  date_limite_t: true,
                },
              },
            },
          },
        },
      },
      list_pm: {
        where: { deleted_at: null, id_sprint: null },
        select: {
          tache: {
            where: { deleted_at: null },
            select: {
              id_tache: true,
              statut_t: true,
              date_limite_t: true,
            },
          },
        },
      },
    },
  });
}

export async function computeProjectTaskStatsBatch(
  projectIds: number[]
): Promise<Map<number, ProjectTaskStats>> {
  const result = new Map<number, ProjectTaskStats>();
  for (const pid of projectIds) {
    result.set(pid, emptyBucket());
  }
  if (!projectIds.length) return result;

  const projects = await loadProjectsHierarchy(projectIds);

  for (const project of projects) {
    const bucket = emptyBucket();
    const tasks = collectTasksFromHierarchy(project);
    for (const task of tasks) tallyTask(bucket, task);
    result.set(project.id_projet, finalizeBucket(bucket));
  }

  return result;
}

export async function computeProjectTaskStats(
  projectId: number
): Promise<ProjectTaskStats> {
  const map = await computeProjectTaskStatsBatch([projectId]);
  return map.get(projectId) ?? { ...EMPTY_STATS };
}

/** Sprint/list index for loading flat task rows (sidebar tree). */
export async function loadProjectHierarchyIndex(projectIds: number[]) {
  if (!projectIds.length) {
    return {
      sprintIdsByProject: new Map<number, number[]>(),
      listIdsByProject: new Map<number, number[]>(),
      projectIdBySprint: new Map<number, number>(),
      projectIdByList: new Map<number, number>(),
      allSprintIds: [] as number[],
      allListIds: [] as number[],
    };
  }

  const [sprints, lists] = await Promise.all([
    prisma.sprint.findMany({
      where: { id_projet: { in: projectIds }, deleted_at: null },
      select: { id_sprint: true, id_projet: true },
    }),
    prisma.list_pm.findMany({
      where: { id_projet: { in: projectIds }, deleted_at: null },
      select: { id_list: true, id_projet: true },
    }),
  ]);

  const sprintIdsByProject = new Map<number, number[]>();
  const listIdsByProject = new Map<number, number[]>();
  const projectIdBySprint = new Map<number, number>();
  const projectIdByList = new Map<number, number>();

  for (const s of sprints) {
    const pid = Number(s.id_projet);
    if (!sprintIdsByProject.has(pid)) sprintIdsByProject.set(pid, []);
    sprintIdsByProject.get(pid)!.push(s.id_sprint);
    projectIdBySprint.set(s.id_sprint, pid);
  }
  for (const l of lists) {
    const pid = Number(l.id_projet);
    if (!listIdsByProject.has(pid)) listIdsByProject.set(pid, []);
    listIdsByProject.get(pid)!.push(l.id_list);
    projectIdByList.set(l.id_list, pid);
  }

  return {
    sprintIdsByProject,
    listIdsByProject,
    projectIdBySprint,
    projectIdByList,
    allSprintIds: sprints.map((s) => s.id_sprint),
    allListIds: lists.map((l) => l.id_list),
  };
}

export function buildProjectTasksWhere(
  projectIds: number[],
  allSprintIds: number[],
  allListIds: number[]
): Prisma.tacheWhereInput {
  const or: Prisma.tacheWhereInput[] = [{ id_projet: { in: projectIds } }];
  if (allListIds.length) or.push({ id_list: { in: allListIds } });
  if (allSprintIds.length) or.push({ id_sprint: { in: allSprintIds } });
  return { deleted_at: null, OR: or };
}

export function resolveTaskProjectId(
  task: {
    id_tache: number;
    id_projet?: number | null;
    id_list?: number | null;
    id_sprint?: number | null;
  },
  projectIdByList: Map<number, number>,
  projectIdBySprint: Map<number, number>
): number | null {
  if (task.id_projet != null && Number(task.id_projet) > 0) {
    return Number(task.id_projet);
  }
  if (task.id_list != null && projectIdByList.has(Number(task.id_list))) {
    return projectIdByList.get(Number(task.id_list))!;
  }
  if (task.id_sprint != null && projectIdBySprint.has(Number(task.id_sprint))) {
    return projectIdBySprint.get(Number(task.id_sprint))!;
  }
  return null;
}
