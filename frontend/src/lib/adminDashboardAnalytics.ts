import type { Projet } from '../types/project';
import { ProjectStatus } from '../types/project';
import i18n from '../i18n/config';

export type AdminProjectEvolutionPoint = {
  label: string;
  total: number;
  newProjects: number;
};

export type AdminProjectStatusBar = {
  key: string;
  name: string;
  value: number;
  color: string;
};

export type AdminProjectProgressItem = AdminProjectStatusBar & {
  percent: number;
};

export type AdminDashboardProjectBucket =
  | 'planning'
  | 'in_progress'
  | 'completed'
  | 'delayed';

const PROJECT_STATUS_COLORS = {
  planning: '#a78bfa',
  in_progress: '#6366f1',
  completed: '#10b981',
  delayed: '#f97316',
} as const;

function normalizeStatusKey(statut?: string | null): string {
  return String(statut ?? ProjectStatus.PLANNING)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s-]/g, '_');
}

function isCompletedStatus(statut?: string | null): boolean {
  const status = normalizeStatusKey(statut);
  return (
    status === 'COMPLETED' ||
    status === 'TERMINE' ||
    status === 'TERMINEE' ||
    status === 'LIVRE' ||
    status === 'LIVREE'
  );
}

function isDelayedStatus(statut?: string | null): boolean {
  const status = normalizeStatusKey(statut);
  return status === 'DELAYED' || status === 'EN_RETARD' || status === 'RETARD';
}

function isInProgressStatus(statut?: string | null): boolean {
  const status = normalizeStatusKey(statut);
  return (
    status === 'IN_PROGRESS' ||
    status === 'EN_COURS' ||
    status === 'ACTIVE' ||
    status === 'ACTIF'
  );
}

/** Progress % from API task stats (same source as page Projets). */
export function projectProgressPercent(project: Projet): number {
  const fromApi = project.progressPercent ?? project.avancement;
  if (typeof fromApi === 'number' && Number.isFinite(fromApi)) {
    return Math.max(0, Math.min(100, Math.round(fromApi)));
  }
  const total =
    project.totalTasks ??
    project.tachesCount ??
    project._count?.tache ??
    0;
  const completed = project.completedTasks ?? 0;
  if (total > 0) {
    return Math.round((completed / total) * 100);
  }
  return 0;
}

export function isProjectCompletedByTaskStats(project: Projet): boolean {
  const progress = projectProgressPercent(project);
  if (progress >= 100) return true;
  const total =
    project.totalTasks ??
    project.tachesCount ??
    project._count?.tache ??
    0;
  const completed = project.completedTasks ?? 0;
  return total > 0 && completed >= total;
}

/**
 * Dashboard bucket from real task data first, then statut_p fallback.
 * Aligns with GET /projets `dashboardBucket` when present.
 */
export function resolveAdminDashboardProjectBucket(
  project: Projet
): AdminDashboardProjectBucket {
  const apiBucket = (project as Projet & { dashboardBucket?: string })
    .dashboardBucket;
  if (
    apiBucket === 'planning' ||
    apiBucket === 'in_progress' ||
    apiBucket === 'completed' ||
    apiBucket === 'delayed'
  ) {
    return apiBucket;
  }

  if (isProjectCompletedByTaskStats(project) || isCompletedStatus(project.statut_p)) {
    return 'completed';
  }

  const lateTasks = project.lateTasks ?? 0;
  if (lateTasks > 0 || isDelayedStatus(project.statut_p)) {
    return 'delayed';
  }

  const progress = projectProgressPercent(project);
  const inProgressTasks = project.inProgressTasks ?? 0;
  if (progress > 0 || inProgressTasks > 0 || isInProgressStatus(project.statut_p)) {
    return 'in_progress';
  }

  return 'planning';
}

function projectCreatedAt(project: Projet): Date | null {
  const raw = project.createdAt ?? project.date_debut;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function countProjectsByStatus(projects: Projet[]) {
  const counts = {
    planning: 0,
    in_progress: 0,
    completed: 0,
    delayed: 0,
  };

  for (const project of projects) {
    const bucket = resolveAdminDashboardProjectBucket(project);
    counts[bucket] += 1;
  }

  return counts;
}

export function buildAdminProjectEvolution(
  projects: Projet[],
  weeks = 8
): AdminProjectEvolutionPoint[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const weekStarts: Date[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = new Date(now);
    start.setDate(now.getDate() - i * 7);
    weekStarts.push(start);
  }

  const firstWeekStart = weekStarts[0] ?? now;
  let runningTotal = projects.filter((project) => {
    const created = projectCreatedAt(project);
    return created != null && created < firstWeekStart;
  }).length;

  return weekStarts.map((weekStart, index) => {
    const weekEnd =
      index < weekStarts.length - 1
        ? weekStarts[index + 1]
        : new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const newProjects = projects.filter((project) => {
      const created = projectCreatedAt(project);
      return created != null && created >= weekStart && created < weekEnd;
    }).length;

    runningTotal += newProjects;

    return {
      label: weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      total: runningTotal,
      newProjects,
    };
  });
}

export function buildAdminProjectStatusBars(projects: Projet[]): AdminProjectStatusBar[] {
  const counts = countProjectsByStatus(projects);
  const t = i18n.t.bind(i18n);

  return [
    {
      key: 'planning',
      name: t('dashboard.statusPlanning'),
      value: counts.planning,
      color: PROJECT_STATUS_COLORS.planning,
    },
    {
      key: 'in_progress',
      name: t('dashboard.statusInProgress'),
      value: counts.in_progress,
      color: PROJECT_STATUS_COLORS.in_progress,
    },
    {
      key: 'completed',
      name: t('dashboard.statusCompleted'),
      value: counts.completed,
      color: PROJECT_STATUS_COLORS.completed,
    },
    {
      key: 'delayed',
      name: t('dashboard.statusDelayed'),
      value: counts.delayed,
      color: PROJECT_STATUS_COLORS.delayed,
    },
  ];
}

export function buildAdminProjectProgress(projects: Projet[]): AdminProjectProgressItem[] {
  const bars = buildAdminProjectStatusBars(projects);
  const total = projects.length;

  return bars.map((bar) => ({
    ...bar,
    percent: total > 0 ? Math.round((bar.value / total) * 100) : 0,
  }));
}

export function countActiveAdminProjects(projects: Projet[]): number {
  return projects.filter(
    (p) => resolveAdminDashboardProjectBucket(p) !== 'completed'
  ).length;
}
