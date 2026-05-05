import api from './api';

export interface Permission {
  id_permission: number;
  nom: string;
  description: string;
}

export const permissionService = {
  async getAll(): Promise<Permission[]> {
    const response = await api.get<Permission[]>('/permissions');
    return response.data;
  },

  async getRolePermissions(roleId: number): Promise<Permission[]> {
    const response = await api.get<Permission[]>(`/permissions/role/${roleId}`);
    return response.data;
  },

  async assignToRole(roleId: number, permissionId: number): Promise<void> {
    await api.post('/permissions/assign', { roleId, permissionId });
  },

  async removeFromRole(roleId: number, permissionId: number): Promise<void> {
    await api.post('/permissions/remove', { roleId, permissionId });
  },

  async getEnterpriseRoles(enterpriseId: number): Promise<any[]> {
    const response = await api.get(`/roles/entreprise/${enterpriseId}`);
    return response.data;
  }
};
