import type { Projet } from '../types/project';
import { ProjectStatus } from '../types/project';

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

const PROJECT_STATUS_COLORS = {
  planning: '#a78bfa',
  in_progress: '#6366f1',
  completed: '#10b981',
  delayed: '#f97316',
} as const;

function projectCreatedAt(project: Projet): Date | null {
  const raw = project.createdAt ?? project.date_debut;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeStatusKey(statut?: string | null): string {
  return String(statut ?? ProjectStatus.PLANNING)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s-]/g, '_');
}

function countProjectsByStatus(projects: Projet[]) {
  const counts = {
    planning: 0,
    in_progress: 0,
    completed: 0,
    delayed: 0,
  };

  for (const project of projects) {
    const status = normalizeStatusKey(project.statut_p);
    if (
      status === 'COMPLETED' ||
      status === 'TERMINE' ||
      status === 'TERMINEE' ||
      status === 'LIVRE' ||
      status === 'LIVREE'
    ) {
      counts.completed += 1;
      continue;
    }
    if (status === 'DELAYED' || status === 'EN_RETARD' || status === 'RETARD') {
      counts.delayed += 1;
      continue;
    }
    if (
      status === 'IN_PROGRESS' ||
      status === 'EN_COURS' ||
      status === 'ACTIVE' ||
      status === 'ACTIF'
    ) {
      counts.in_progress += 1;
      continue;
    }
    counts.planning += 1;
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

  return [
    {
      key: 'planning',
      name: 'Planning',
      value: counts.planning,
      color: PROJECT_STATUS_COLORS.planning,
    },
    {
      key: 'in_progress',
      name: 'En cours',
      value: counts.in_progress,
      color: PROJECT_STATUS_COLORS.in_progress,
    },
    {
      key: 'completed',
      name: 'Terminé',
      value: counts.completed,
      color: PROJECT_STATUS_COLORS.completed,
    },
    {
      key: 'delayed',
      name: 'En retard',
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
