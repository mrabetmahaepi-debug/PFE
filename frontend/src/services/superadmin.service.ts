import api from './api';
import type { User } from '../types/auth.types';

export interface Invitation {
  id_invitation: number;
  email: string;
  id_role?: number;
  id_entreprise?: number;
}

export interface ApprovalsResponse {
  users: User[];
  invitations: Invitation[];
}

export const superAdminService = {
  async getPendingUsers(): Promise<User[]> {
    const response = await api.get<User[]>('/superadmin/pending-users');
    return response.data;
  },

  async getApprovals(): Promise<ApprovalsResponse> {
    const response = await api.get<ApprovalsResponse>('/superadmin/approvals');
    return response.data;
  },

  async approveUser(id: number, id_entreprise: number): Promise<void> {
    await api.put(`/superadmin/approve/${id}`, { id_entreprise });
  },

  async rejectUser(id: number): Promise<void> {
    await api.put(`/superadmin/reject/${id}`);
  },

  async approveInvitation(id: number): Promise<void> {
    await api.put(`/superadmin/approve-invitation/${id}`);
  },

  async rejectInvitation(id: number): Promise<void> {
    await api.put(`/superadmin/reject-invitation/${id}`);
  },

  async getDashboardStats(): Promise<any> {
    const response = await api.get('/superadmin/stats');
    return response.data;
  },

  async searchGlobal(query: string): Promise<any> {
    const response = await api.get(`/superadmin/search?q=${query}`);
    return response.data;
  }
};
