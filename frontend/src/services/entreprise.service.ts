import api from './api';

export interface Entreprise {
  id_entreprise: number;
  nom: string;
  adresse: string;
  createdAt: string;
  statut?: string;
  admin?: {
    nom: string;
    prenom: string;
    email: string;
  };
  projet?: any[];
  utilisateur?: any[];
}

export const entrepriseService = {
  async getAll(): Promise<Entreprise[]> {
    const response = await api.get<any>('/entreprises');
    const result = response.data?.data;
    if (result && Array.isArray(result.items)) {
      return result.items;
    }
    return Array.isArray(result) ? result : [];
  },

  async getById(id: number): Promise<Entreprise> {
    const response = await api.get<any>(`/entreprises/${id}`);
    return response.data?.data || response.data;
  },

  async create(data: Partial<Entreprise>): Promise<Entreprise> {
    const response = await api.post<any>('/entreprises', data);
    return response.data?.data || response.data;
  },

  async update(id: number, data: Partial<Entreprise>): Promise<Entreprise> {
    const response = await api.put<any>(`/entreprises/${id}`, data);
    return response.data?.data || response.data;
  },

  async toggleStatus(id: number): Promise<Entreprise> {
    const response = await api.put<any>(`/entreprises/${id}/toggle-status`);
    return response.data?.data || response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/entreprises/${id}`);
  },

  async inviteAdmin(data: any): Promise<any> {
    const response = await api.post('/entreprises/invite-admin', data);
    return response.data;
  }
};
