import api from './api';
import type { AppNotification } from '../types/notification';
import { dedupeNotificationsById, normalizeNotification } from '../lib/dedupeNotifications';

export async function fetchMyNotifications(): Promise<AppNotification[]> {
  const { data } = await api.get<AppNotification[]>('/notifications/me');
  const list = Array.isArray(data) ? data : [];
  return dedupeNotificationsById(list.map(normalizeNotification));
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const { data } = await api.get<{ count?: number }>('/notifications/unread-count');
  const n = Number(data?.count);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function markNotificationRead(id: number): Promise<AppNotification> {
  const { data } = await api.patch<AppNotification>(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch('/notifications/read');
}

export async function deleteNotification(id: number): Promise<void> {
  await api.delete(`/notifications/${id}`);
}

export async function deleteAllNotifications(): Promise<void> {
  await api.delete('/notifications/all');
}
