import { ProjectStatus } from '../types/project';

export const PROJECT_STATUS_ENUM_VALUES = new Set<string>(Object.values(ProjectStatus));

export const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Tous Statuts' },
  { value: ProjectStatus.PLANNING, label: 'Planning' },
  { value: ProjectStatus.IN_PROGRESS, label: 'En cours' },
  { value: ProjectStatus.DELAYED, label: 'En retard' },
  { value: ProjectStatus.ON_HOLD, label: 'En attente' },
  { value: ProjectStatus.COMPLETED, label: 'Terminé' },
];

export function getRawProjectStatus(project: {
  statut_p?: unknown;
  status?: unknown;
  statut?: unknown;
}): string {
  const extra = project as { statut?: unknown };
  const v = project.statut_p ?? project.status ?? extra.statut;
  return String(v ?? '').trim();
}

/** Canonical enum from API / DB / French labels (accents & spaces tolerant). */
export function normalizeProjectStatus(status: unknown): ProjectStatus | null {
  const raw = String(status ?? '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const aliases: Record<string, ProjectStatus> = {
    PLANNING: ProjectStatus.PLANNING,
    PLAN: ProjectStatus.PLANNING,
    IN_PROGRESS: ProjectStatus.IN_PROGRESS,
    INPROGRESS: ProjectStatus.IN_PROGRESS,
    EN_COURS: ProjectStatus.IN_PROGRESS,
    ENCOURS: ProjectStatus.IN_PROGRESS,
    COURS: ProjectStatus.IN_PROGRESS,
    COMPLETED: ProjectStatus.COMPLETED,
    COMPLETE: ProjectStatus.COMPLETED,
    TERMINE: ProjectStatus.COMPLETED,
    TERMINEE: ProjectStatus.COMPLETED,
    DONE: ProjectStatus.COMPLETED,
    FINISHED: ProjectStatus.COMPLETED,
    ON_HOLD: ProjectStatus.ON_HOLD,
    ONHOLD: ProjectStatus.ON_HOLD,
    EN_ATTENTE: ProjectStatus.ON_HOLD,
    ENATTENTE: ProjectStatus.ON_HOLD,
    ATTENTE: ProjectStatus.ON_HOLD,
    HOLD: ProjectStatus.ON_HOLD,
    DELAYED: ProjectStatus.DELAYED,
    EN_RETARD: ProjectStatus.DELAYED,
    ENRETARD: ProjectStatus.DELAYED,
    RETARD: ProjectStatus.DELAYED,
    LATE: ProjectStatus.DELAYED,
  };

  if (aliases[raw]) return aliases[raw];
  if (PROJECT_STATUS_ENUM_VALUES.has(raw)) return raw as ProjectStatus;
  return null;
}

export function formatProjectStatus(status: unknown): string {
  const norm = normalizeProjectStatus(status);
  switch (norm) {
    case ProjectStatus.IN_PROGRESS:
      return 'En cours';
    case ProjectStatus.COMPLETED:
      return 'Terminé';
    case ProjectStatus.ON_HOLD:
      return 'En attente';
    case ProjectStatus.DELAYED:
      return 'En retard';
    case ProjectStatus.PLANNING:
      return 'Planning';
    default: {
      const s = String(status ?? '').trim();
      return s ? s.replace(/_/g, ' ') : 'Planning';
    }
  }
}

export function projectMatchesStatusFilter(
  project: { statut_p?: unknown; status?: unknown; statut?: unknown },
  filter: ProjectStatus | 'ALL',
): boolean {
  if (filter === 'ALL') return true;
  return normalizeProjectStatus(getRawProjectStatus(project)) === filter;
}

export function getProjectStatusColor(status: unknown): string {
  const norm = normalizeProjectStatus(status);
  switch (norm) {
    case ProjectStatus.IN_PROGRESS:
      return '#4f46e5';
    case ProjectStatus.COMPLETED:
      return '#10b981';
    case ProjectStatus.ON_HOLD:
      return '#f59e0b';
    case ProjectStatus.DELAYED:
      return '#ef4444';
    case ProjectStatus.PLANNING:
    default:
      return '#64748b';
  }
}
