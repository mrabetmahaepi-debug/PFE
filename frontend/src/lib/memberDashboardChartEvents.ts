import type { EnterpriseActivityItem } from '../services/activity.service';

/** Actions counted in « Activité des 7 derniers jours ». */
const CHART_ACTIONS = new Set([
  'Tâche créée',
  'Sous-tâche créée',
  'Tâche terminée',
  'Passée en EN COURS',
  'Tâche en retard',
  'Statut modifié',
  'Commentaire ajouté',
  'Sprint créé',
  'Liste créée',
  'Projet créé',
  'Nouveau projet créé',
]);

export function isMemberChartActivityItem(item: EnterpriseActivityItem): boolean {
  const action = item.action?.trim() ?? '';
  if (!action) return false;
  if (CHART_ACTIONS.has(action)) return true;
  return /^statut\s+modifié/i.test(action);
}

export function filterMemberChartActivities(
  items: EnterpriseActivityItem[]
): EnterpriseActivityItem[] {
  return items.filter(isMemberChartActivityItem);
}
