import type { TaskHistoryEntry } from '../types/taskActivity';
import { memberListPriorityLabel } from './memberStatusPill';
import { memberWorkflowStatusLabel } from './memberStatusPill';

export function taskCommentAuthorName(u: {
  prenom?: string | null;
  nom?: string | null;
  email?: string | null;
}): string {
  const name = `${u.prenom || ''} ${u.nom || ''}`.trim();
  return name || u.email || 'Utilisateur';
}

function formatHistoryValue(fieldKey: string, value: string | null): string {
  if (!value) return '—';
  if (fieldKey === 'statut_t') return memberWorkflowStatusLabel(value);
  if (fieldKey === 'priorite_t') return memberListPriorityLabel(value);
  return value;
}

export function formatTaskHistoryLine(entry: TaskHistoryEntry): string {
  const { field_key, old_value, new_value } = entry;
  switch (field_key) {
    case 'statut_t':
      return `Statut modifié : ${formatHistoryValue(field_key, old_value)} → ${formatHistoryValue(field_key, new_value)}`;
    case 'priorite_t':
      return `Priorité modifiée : ${formatHistoryValue(field_key, old_value)} → ${formatHistoryValue(field_key, new_value)}`;
    case 'assigne_a':
      return `Assigné modifié : ${old_value || '—'} → ${new_value || '—'}`;
    case 'date_debut_t':
      return `Date de début : ${old_value || '—'} → ${new_value || '—'}`;
    case 'date_limite_t':
      return `Date d'échéance : ${old_value || '—'} → ${new_value || '—'}`;
    case 'description_t':
      return 'Description mise à jour';
    case 'nom_t':
      return `Titre modifié : ${old_value || '—'} → ${new_value || '—'}`;
    case 'comment':
      return new_value ? `Commentaire : ${new_value}` : 'Commentaire ajouté';
    default:
      return 'Modification';
  }
}

export function formatActivityDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
