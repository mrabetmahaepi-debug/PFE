import api from './api';

export interface AdminAccess {
  id_membre_projet: number;
  id_utilisateur: number;
  id_projet: number;
  projet?: {
    id_projet: number;
    nom_p: string;
  };
}

export const accessService = {
  async getAdmins() {
    const response = await api.get('/access/admins');
    return response.data?.data || response.data;
  },

  async getProjects() {
    const response = await api.get('/access/projects');
    return response.data?.data || response.data;
  },

  async getAdminAccess(adminId: number): Promise<AdminAccess[]> {
    const response = await api.get(`/access/admin-access/${adminId}`);
    return response.data?.data || response.data;
  },

  async assignProject(adminId: number, projectId: number) {
    const response = await api.post('/access/assign', {
      id_utilisateur: adminId,
      id_projet: projectId
    });
    return response.data?.data || response.data;
  },

  async unassignProject(adminId: number, projectId: number) {
    const response = await api.delete('/access/unassign', {
      params: {
        id_utilisateur: adminId,
        id_projet: projectId
      }
    });
    return response.data?.data || response.data;
  }
};
