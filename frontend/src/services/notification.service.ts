import api from './api';

export interface Notification {
  num_notification: number;
  sujet: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  date_envoi: string;
  metadata?: string;
}

export const notificationService = {
  async getAll(): Promise<Notification[]> {
    const response = await api.get<Notification[]>('/notifications/me');
    return response.data;
  },

  async markAsRead(id: number): Promise<void> {
    await api.put(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.put('/notifications/read-all');
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/notifications/${id}`);
  }
};
