import type { AppNotification } from '../types/notification';
import { markAllNotificationsRead } from '../services/notification.service';
import { dispatchNotificationsRefresh } from './workspaceEvents';

/** Marque toutes les notifications comme lues côté UI. */
export function markAllNotificationsReadOptimistic(
  notifications: AppNotification[]
): AppNotification[] {
  return notifications.map((n) => ({ ...n, is_read: true }));
}

/** Badge à 0 immédiatement, puis PATCH /notifications/read. */
export async function markAllInboxNotificationsAsRead(): Promise<void> {
  dispatchNotificationsRefresh({ unreadCount: 0 });
  await markAllNotificationsRead();
}
