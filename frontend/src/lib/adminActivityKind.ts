import type {
  EnterpriseActivityItem,
  EnterpriseActivityType,
} from '../services/activity.service';

/** Short category label shown under the activity title (admin dashboard). */
export function getAdminActivityKindLabel(
  item: Pick<EnterpriseActivityItem, 'action' | 'type' | 'category'>
): string {
  const action = (item.action || '').toLowerCase();

  if (/projet.*cré|nouveau projet/i.test(action)) return 'Nouveau projet';
  if (/projet.*termin/i.test(action)) return 'Projet terminé';
  if (/projet.*retard/i.test(action)) return 'Projet en retard';
  if (/tâche.*termin/i.test(action)) return 'Tâche terminée';
  if (/tâche.*cours/i.test(action)) return 'Tâche en cours';
  if (/tâche.*cré/i.test(action)) return 'Nouvelle tâche';
  if (/échéance/i.test(action)) return 'Échéance';
  if (/invitation.*accept/i.test(action)) return 'Invitation acceptée';
  if (/invitation/i.test(action)) return 'Invitation';
  if (/membre|admin invité/i.test(action)) return 'Équipe';
  if (/accès projet.*accord|ajouté.*projet/i.test(action)) return 'Accès projet';
  if (/accès projet.*retir|retiré/i.test(action)) return 'Retrait accès';
  if (/permission/i.test(action)) return 'Permissions';

  switch (item.category) {
    case 'projects':
      return 'Projet';
    case 'tasks':
      return 'Tâche';
    case 'team':
      return 'Équipe';
    case 'admin':
      return 'Administration';
    default:
      break;
  }

  switch (item.type as EnterpriseActivityType) {
    case 'project':
      return 'Projet';
    case 'task':
      return 'Tâche';
    case 'invitation':
      return 'Invitation';
    case 'user':
    case 'member':
      return 'Équipe';
    case 'access':
      return 'Administration';
    default:
      return 'Activité';
  }
}
