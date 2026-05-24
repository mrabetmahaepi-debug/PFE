import type { ListStatusPM } from '../types/hierarchy';

export type StatusTone =
  | 'gray'
  | 'blue'
  | 'green'
  | 'red'
  | 'orange'
  | 'purple'
  | 'neutral';

const TONE_BY_KEY: Record<string, StatusTone> = {
  todo: 'gray',
  todo_open: 'gray',
  en_cours: 'blue',
  en_retard: 'orange',
  terminee: 'green',
  bloquee: 'red',
  en_revision: 'purple',
  review: 'purple',
};

export function getStatusTone(statutKey: string): StatusTone {
  const k = statutKey.trim().toLowerCase();
  return TONE_BY_KEY[k] ?? 'neutral';
}

export function getStatusLabel(
  statutKey: string,
  statuses: ListStatusPM[]
): string {
  const k = statutKey.trim().toLowerCase();
  const hit = statuses.find((s) => s.statut_key.toLowerCase() === k);
  if (hit) return hit.label;
  const fallbacks: Record<string, string> = {
    todo: 'À faire',
    en_cours: 'En cours',
    en_retard: 'En retard',
    terminee: 'Terminé',
    bloquee: 'Bloquée',
    en_revision: 'En révision',
  };
  return fallbacks[k] ?? statutKey;
}
