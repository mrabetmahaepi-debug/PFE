import { useCallback, useEffect, useState } from 'react';
import { fetchUnreadNotificationCount } from '../services/notification.service';
import {
  NOTIFICATIONS_REFRESH_EVENT,
  type NotificationsRefreshDetail,
} from '../lib/workspaceEvents';

const POLL_MS = 30_000;

/** Nombre de notifications non lues pour le badge sidebar « Boîte de réception ». */
export function useInboxUnreadCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      return;
    }
    try {
      const unread = await fetchUnreadNotificationCount();
      setCount(unread);
    } catch {
      setCount(0);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    const onRefresh = (e: Event) => {
      const detail = (e as CustomEvent<NotificationsRefreshDetail>).detail;
      if (detail && typeof detail.unreadCount === 'number') {
        setCount(Math.max(0, detail.unreadCount));
        return;
      }
      void refresh();
    };
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
    return () =>
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const intervalId = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [enabled, refresh]);

  return count;
}
