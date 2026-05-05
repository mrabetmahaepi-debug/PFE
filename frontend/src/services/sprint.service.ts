import api from './api';
import type { Sprint, CreateSprintData } from '../types/sprint';

export const sprintService = {
  async getByProject(projectId: string): Promise<Sprint[]> {
    const response = await api.get<Sprint[]>(`/sprints/projet/${projectId}`);
    return response.data;
  },

  async getById(id: string): Promise<Sprint> {
    const response = await api.get<Sprint>(`/sprints/${id}`);
    return response.data;
  },

  async create(data: CreateSprintData): Promise<Sprint> {
    const response = await api.post<Sprint>('/sprints', data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateSprintData>): Promise<Sprint> {
    const response = await api.put<Sprint>(`/sprints/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/sprints/${id}`);
  }
};
