import type { Tache } from '../types/task';
import type { Projet } from '../types/project';

export const MEMBER_PROJECT_CHART_COLORS = [
  '#14b8a6',
  '#0ea5e9',
  '#8b5cf6',
  '#ec4899',
  '#22c55e',
  '#f59e0b',
] as const;

export type MemberProjectTaskSegment = {
  key: string;
  project: string;
  total: number;
  color: string;
};

export function segmentPercent(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

function resolveProjectLabel(
  task: Tache,
  projectNameById: Map<number, string>
): string {
  const projectId = Number(task.id_projet);
  if (!Number.isFinite(projectId) || projectId <= 0) {
    return 'Sans projet';
  }

  const fromList = projectNameById.get(projectId);
  const fromTask = task.projet?.nom_p?.trim();
  if (fromTask) return fromTask;
  if (fromList) return fromList;
  return `Projet #${projectId}`;
}

export function buildMemberTasksByProjectInsights(
  tasks: Tache[],
  projects: Projet[],
  userId?: number
): { segments: MemberProjectTaskSegment[]; total: number } {
  const projectNameById = new Map<number, string>();
  for (const p of projects) {
    const id = Number(p.id_projet);
    if (!Number.isFinite(id) || id <= 0) continue;
    const name = p.nom_p?.trim();
    if (name) projectNameById.set(id, name);
  }

  let memberTasks =
    userId != null
      ? tasks.filter((t) => Number(t.assigne_a) === Number(userId))
      : [...tasks];

  if (userId != null && memberTasks.length === 0 && tasks.length > 0) {
    memberTasks = [...tasks];
  }

  for (const task of memberTasks) {
    const id = Number(task.id_projet);
    const name = task.projet?.nom_p?.trim();
    if (Number.isFinite(id) && id > 0 && name) {
      projectNameById.set(id, name);
    }
  }

  const projectStats = memberTasks.reduce<Record<string, number>>((acc, task) => {
    const project = resolveProjectLabel(task, projectNameById);
    acc[project] = (acc[project] || 0) + 1;
    return acc;
  }, {});

  const segments = Object.entries(projectStats)
    .map(([project, total], index) => ({
      key: `${project}-${index}`,
      project,
      total,
      color: MEMBER_PROJECT_CHART_COLORS[index % MEMBER_PROJECT_CHART_COLORS.length],
    }))
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total);

  return { segments, total: memberTasks.length };
}
