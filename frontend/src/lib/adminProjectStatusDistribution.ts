import type { Projet } from '../types/project';
import { resolveAdminDashboardProjectBucket } from './adminDashboardAnalytics';

export type ProjectStatusBucket = 'active' | 'completed' | 'delayed' | 'pending';

export type StatusSegment = {
  key: ProjectStatusBucket;
  name: string;
  value: number;
  color: string;
};

export type AdminProjectInsightsData = {
  total: number;
  segments: StatusSegment[];
  completionRate: number;
  delayRisk: number;
  weeklyGrowth: number;
};

const SEGMENT_META: Record<
  ProjectStatusBucket,
  { name: string; color: string }
> = {
  active: { name: 'Actifs', color: '#4f46e5' },
  completed: { name: 'Terminés', color: '#10b981' },
  delayed: { name: 'En retard', color: '#ef4444' },
  pending: { name: 'En attente', color: '#f59e0b' },
};

const BUCKET_ORDER: ProjectStatusBucket[] = [
  'active',
  'completed',
  'delayed',
  'pending',
];

export function normalizeProjectStatusBucket(
  projectOrStatut: Projet | string | null | undefined
): ProjectStatusBucket {
  if (projectOrStatut != null && typeof projectOrStatut === 'object') {
    const bucket = resolveAdminDashboardProjectBucket(projectOrStatut);
    if (bucket === 'completed') return 'completed';
    if (bucket === 'delayed') return 'delayed';
    if (bucket === 'in_progress') return 'active';
    return 'pending';
  }

  const s = String(projectOrStatut ?? 'PLANNING')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s-]/g, '_');

  if (
    s === 'COMPLETED' ||
    s === 'TERMINE' ||
    s === 'TERMINEE' ||
    s === 'LIVRE' ||
    s === 'LIVREE'
  ) {
    return 'completed';
  }
  if (s === 'DELAYED' || s === 'EN_RETARD' || s === 'RETARD') {
    return 'delayed';
  }
  if (s === 'IN_PROGRESS' || s === 'EN_COURS' || s === 'ACTIVE' || s === 'ACTIF') {
    return 'active';
  }
  return 'pending';
}

function projectCreatedAt(p: Projet): Date | null {
  const raw = p.createdAt ?? p.date_debut;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildAdminProjectInsights(projects: Projet[]): AdminProjectInsightsData {
  const counts: Record<ProjectStatusBucket, number> = {
    active: 0,
    completed: 0,
    delayed: 0,
    pending: 0,
  };

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  let createdThisWeek = 0;
  let createdLastWeek = 0;

  for (const p of projects) {
    const bucket = normalizeProjectStatusBucket(p);
    counts[bucket] += 1;

    const created = projectCreatedAt(p);
    if (created) {
      const age = now - created.getTime();
      if (age >= 0 && age < weekMs) createdThisWeek += 1;
      else if (age >= weekMs && age < weekMs * 2) createdLastWeek += 1;
    }
  }

  const total = projects.length;
  const segments: StatusSegment[] = BUCKET_ORDER.map((key) => ({
    key,
    name: SEGMENT_META[key].name,
    value: counts[key],
    color: SEGMENT_META[key].color,
  }));

  const completionRate =
    total > 0 ? Math.round((counts.completed / total) * 100) : 0;
  const delayRisk = total > 0 ? Math.round((counts.delayed / total) * 100) : 0;
  const weeklyGrowth =
    createdLastWeek > 0
      ? Math.round(((createdThisWeek - createdLastWeek) / createdLastWeek) * 100)
      : createdThisWeek > 0
        ? 100
        : 0;

  return {
    total,
    segments,
    completionRate,
    delayRisk,
    weeklyGrowth,
  };
}

export function segmentPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}
