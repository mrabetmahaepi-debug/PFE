import type { AppNotification } from '../types/notification';

/** Normalise `is_read` (API / legacy shapes). */
export function normalizeNotification(n: AppNotification): AppNotification {
  const raw = n as AppNotification & {
    read?: boolean;
    isRead?: boolean;
  };
  const is_read = Boolean(
    raw.is_read ?? raw.read ?? raw.isRead ?? false
  );
  return { ...n, is_read };
}

/** Keep first occurrence per notification id (API or optimistic duplicates). */
export function dedupeNotificationsById(
  list: AppNotification[]
): AppNotification[] {
  const seen = new Set<number>();
  const out: AppNotification[] = [];
  for (const n of list) {
    const id = n.num_notification;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(normalizeNotification(n));
  }
  return out;
}
export function mergeNotification(
  prev: AppNotification[],
  incoming: AppNotification
): AppNotification[] {
  if (prev.some((n) => n.num_notification === incoming.num_notification)) {
    return prev;
  }
  return [incoming, ...prev];
}
