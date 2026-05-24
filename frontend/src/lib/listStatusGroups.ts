import { TaskStatus, type Tache } from '../types/task';
import type { ListStatusPM } from '../types/hierarchy';

/** Default groups when API is unavailable */
export const FALLBACK_LIST_STATUSES: Omit<
  ListStatusPM,
  'id_status' | 'id_list'
>[] = [
  { label: 'À faire', statut_key: 'todo', position: 0, is_system: true },
  { label: 'En cours', statut_key: 'en_cours', position: 1, is_system: true },
  { label: 'En retard', statut_key: 'en_retard', position: 2, is_system: true },
  { label: 'Terminé', statut_key: 'terminee', position: 3, is_system: true },
  { label: 'Bloquée', statut_key: 'bloquee', position: 4, is_system: true },
  { label: 'En révision', statut_key: 'en_revision', position: 5, is_system: true },
];

export function normalizeTaskStatutKey(statut?: string | null): string {
  const raw = String(statut ?? '').trim();
  if (!raw) return 'todo';
  const lower = raw.toLowerCase();
  const upper = raw.toUpperCase();
  if (upper === 'TODO' || upper === 'TO_DO' || lower === 'todo') return 'todo';
  if (upper === 'TODO_OPEN' || lower === 'todo_open') return 'todo_open';
  if (
    upper === 'IN_PROGRESS' ||
    upper === 'EN_COURS' ||
    lower === 'en_cours'
  ) {
    return 'en_cours';
  }
  if (
    upper === 'EN_RETARD' ||
    lower === 'en_retard' ||
    upper === 'OVERDUE'
  ) {
    return 'en_retard';
  }
  if (
    upper === 'DONE' ||
    upper === 'TERMINEE' ||
    upper === 'TERMINE' ||
    upper === 'ACHEVE' ||
    lower === 'terminee' ||
    lower === 'acheve'
  ) {
    return 'terminee';
  }
  if (upper === 'BLOQUEE' || upper === 'BLOCKED' || lower === 'bloquee') {
    return 'bloquee';
  }
  if (
    upper === 'EN_REVISION' ||
    upper === 'REVIEW' ||
    lower === 'en_revision'
  ) {
    return 'en_revision';
  }
  return lower;
}

export function taskMatchesStatusGroup(
  task: Tache,
  statutKey: string
): boolean {
  return (
    normalizeTaskStatutKey(task.statut_t) === statutKey.trim().toLowerCase()
  );
}

/** Map legacy TaskStatus enum to default statut_key for create */
export function taskStatusToStatutKey(
  status?: TaskStatus | string
): string {
  if (!status) return 'todo';
  if (
    typeof status === 'string' &&
    !Object.values(TaskStatus).includes(status as TaskStatus)
  ) {
    return normalizeTaskStatutKey(status);
  }
  switch (status) {
    case TaskStatus.IN_PROGRESS:
      return 'en_cours';
    case 'OVERDUE':
      return 'en_retard';
    case TaskStatus.DONE:
      return 'terminee';
    case TaskStatus.TODO:
    default:
      return 'todo';
  }
}
