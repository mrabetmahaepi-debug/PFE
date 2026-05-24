import type { EnterpriseActivityItem } from '../services/activity.service';

/** Admin dashboard — keep governance actions, hide task noise. */
export function isTenantAdminDashboardActivity(
  item: Pick<EnterpriseActivityItem, 'action' | 'type' | 'category' | 'title'>
): boolean {
  const action = (item.action || '').toLowerCase();
  const title = (item.title || '').toLowerCase();
  const text = `${action} ${title}`;

  if (/estimation automatique|recommandation/i.test(text)) return true;
  if (/invitation/i.test(text) || item.type === 'invitation') return true;
  if (/projet créé|nouveau projet|projet «/i.test(text) || item.type === 'project') {
    if (/tâche|task/i.test(text) && !/projet/i.test(text)) return false;
    return /cré|nouveau|projet/i.test(text);
  }
  if (/rôle|role|permission|accès projet|retrait accès/i.test(text) || item.type === 'access') {
    return true;
  }
  if (
    /inscrit|enregistré|nouveau membre|nouvel utilisateur|membre ajouté|compte activ|utilisateur/i.test(
      text
    ) ||
    item.type === 'user' ||
    item.type === 'member'
  ) {
    return true;
  }
  if (item.category === 'team' || item.category === 'admin') return true;

  return false;
}

export function filterTenantAdminActivities(
  items: EnterpriseActivityItem[]
): EnterpriseActivityItem[] {
  return items.filter(isTenantAdminDashboardActivity);
}

/** Short action chip shown under each admin activity row. */
export function getTenantAdminActionKind(
  item: Pick<EnterpriseActivityItem, 'action' | 'type' | 'title' | 'category'>
): string {
  const action = (item.action || '').toLowerCase();
  const title = (item.title || '').toLowerCase();
  const text = `${action} ${title}`;

  if (/estimation automatique/i.test(text)) return 'Estimation automatique générée';
  if (/recommandation/i.test(text)) return 'Recommandation';
  if (/invitation.*envoy|invitation/i.test(text) || item.type === 'invitation') {
    return 'Invitation envoyée';
  }
  if (/projet créé|nouveau projet/i.test(text)) return 'Projet créé';
  if (/rôle|role|permission/i.test(text) || item.type === 'access') return 'Rôle mis à jour';
  if (
    /inscrit|enregistré|nouveau membre|nouvel utilisateur|compte activ/i.test(text) ||
    item.type === 'user' ||
    item.type === 'member'
  ) {
    return 'Nouvel utilisateur inscrit';
  }

  switch (item.category) {
    case 'admin':
      return 'Administration';
    case 'team':
      return 'Équipe';
    case 'projects':
      return 'Projet créé';
    default:
      return 'Action admin';
  }
}

export function countAdminEstimations(items: EnterpriseActivityItem[]): number {
  return items.filter((item) =>
    /estimation automatique/i.test(`${item.action} ${item.title}`)
  ).length;
}

export function countAdminRecommendations(items: EnterpriseActivityItem[]): number {
  return items.filter((item) =>
    /recommandation/i.test(`${item.action} ${item.title}`)
  ).length;
}
