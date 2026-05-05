import api from './api';
import type { Projet, CreateProjetData } from '../types/project';

export const projectService = {
  async getAll(): Promise<Projet[]> {
    const response = await api.get<Projet[]>('/projets');
    return response.data;
  },

  async getById(id: string | number): Promise<Projet> {
    const response = await api.get<Projet>(`/projets/${id}`);
    return response.data;
  },

  async create(data: CreateProjetData): Promise<Projet> {
    const response = await api.post<Projet>('/projets', data);
    return response.data;
  },

  async update(id: string | number, data: Partial<CreateProjetData>): Promise<Projet> {
    const response = await api.put<Projet>(`/projets/${id}`, data);
    return response.data;
  },

  async delete(id: string | number): Promise<void> {
    await api.delete(`/projets/${id}`);
  },

  async getProgress(projectId: number): Promise<{ progress: number }> {
    const response = await api.get<{ progress: number }>(`/taches/progress/project/${projectId}`);
    return response.data;
  }
};
