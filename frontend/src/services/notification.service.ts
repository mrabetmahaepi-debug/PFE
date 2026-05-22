import api from './api';
import type { AppNotification } from '../types/notification';

export async function fetchMyNotifications(): Promise<AppNotification[]> {
  const { data } = await api.get<AppNotification[]>('/notifications/me');
  return Array.isArray(data) ? data : [];
}

export async function markNotificationRead(id: number): Promise<AppNotification> {
  const { data } = await api.put<AppNotification>(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.put('/notifications/read-all');
}
