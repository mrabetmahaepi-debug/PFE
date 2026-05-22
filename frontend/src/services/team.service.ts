import api from './api';
import type { User } from '../types/auth.types';

export interface CreateMemberData {
  nom: string;
  prenom: string;
  email: string;
  password: string;
  id_role: number;
  poste: string;
  id_entreprise: number;
}

export const teamService = {
  async getAllMembers(params?: Record<string, any>): Promise<User[]> {
    const response = await api.get<User[]>('/utilisateurs', { params });
    return response.data;
  },

  async getMemberById(id: string | number): Promise<User> {
    const response = await api.get<User>(`/utilisateurs/${id}`);
    return response.data;
  },

  async addMember(data: CreateMemberData): Promise<User> {
    const response = await api.post<User>('/utilisateurs', data);
    return response.data;
  },

  async updateMember(id: string, data: Partial<CreateMemberData>): Promise<User> {
    const response = await api.put<User>(`/utilisateurs/${id}`, data);
    return response.data;
  },

  async deleteMember(id: string): Promise<void> {
    await api.delete(`/utilisateurs/${id}`);
  }
};
