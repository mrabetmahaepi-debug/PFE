import type { EnterpriseActivityItem } from '../services/activity.service';

const TASK_ACTIONS = new Set([
  'Tâche créée',
  'Tâche terminée',
  'Passée en EN COURS',
  'Tâche en retard',
  'Tâche assignée',
]);

/** Compact ClickUp-style line: icon + task name + verb phrase. */
export function formatMemberTaskActivityLine(item: EnterpriseActivityItem): string {
  const name = (item.entityLabel || item.title || 'tâche').trim();
  const lower = name.toLowerCase();

  switch (item.action) {
    case 'Tâche terminée':
      return `✓ ${lower} terminée`;
    case 'Tâche créée':
      return `📝 ${lower} créée`;
    case 'Passée en EN COURS':
      return `🔄 ${lower} déplacée vers EN COURS`;
    case 'Tâche en retard':
      return `⏰ ${lower} en retard`;
    case 'Tâche assignée':
      return `📌 ${lower} assignée`;
    default:
      return `• ${item.title || name}`;
  }
}

export function isMemberTaskActivityItem(item: EnterpriseActivityItem): boolean {
  if (item.type === 'task' || item.category === 'tasks') return true;
  return TASK_ACTIONS.has(item.action);
}
