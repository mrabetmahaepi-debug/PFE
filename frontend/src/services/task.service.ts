import api from './api';
import { type Tache, type CreateTaskData, TaskStatus } from '../types/task';

export const taskService = {
  async getByProject(projectId: string): Promise<Tache[]> {
    const response = await api.get<Tache[]>(`/taches/projet/${projectId}`);
    return response.data;
  },

  async getMyTasks(): Promise<Tache[]> {
    const response = await api.get<Tache[]>('/taches/mes-taches');
    return response.data;
  },

  async create(data: CreateTaskData): Promise<Tache> {
    const response = await api.post<Tache>('/taches', data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateTaskData>): Promise<Tache> {
    const response = await api.put<Tache>(`/taches/${id}`, data);
    return response.data;
  },

  async updateStatus(id: string, status: TaskStatus): Promise<Tache> {
    try {
      const response = await api.patch<Tache>(`/taches/mes-taches/${id}/statut`, { statut_t: status });
      return response.data;
    } catch {
      const response = await api.put<Tache>(`/taches/${id}`, { statut_t: status });
      return response.data;
    }
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/taches/${id}`);
  }
};
