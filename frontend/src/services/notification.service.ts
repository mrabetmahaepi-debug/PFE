import api from './api';

export interface Notification {
  num_notification: number;
  sujet: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  date_envoi: string;
  id_utilisateur: number;
  metadata?: string;
}

export const notificationService = {
  async getMyNotifications(): Promise<Notification[]> {
    const response = await api.get<Notification[]>('/notifications/me');
    return response.data;
  },

  async markAsRead(id: number): Promise<void> {
    await api.put(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.put('/notifications/read-all');
  },

  async createNotification(data: Partial<Notification>): Promise<Notification> {
    const response = await api.post<Notification>('/notifications', data);
    return response.data;
  }
};
