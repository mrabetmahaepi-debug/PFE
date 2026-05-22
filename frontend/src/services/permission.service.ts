import api from './api';

export interface Permission {
  id_permission: number;
  nom: string;
  description: string;
}

/** Slugs de permissions **dans un projet** (pas le catalogue global). */
export type ProjectRolePermissionMatrix = Record<string, string[]>;

export interface ProjectRoleMatrixResponse {
  matrix: ProjectRolePermissionMatrix;
  roleLabels: Record<string, string>;
  roleOrder: string[];
  permissionSlugs: string[];
  permissionLabels: Record<string, string>;
}

export const permissionService = {
  async getAll(): Promise<Permission[]> {
    const response = await api.get<Permission[]>('/permissions');
    return response.data;
  },

  async getProjectRoleMatrix(): Promise<ProjectRoleMatrixResponse> {
    const response = await api.get<ProjectRoleMatrixResponse>(
      '/permissions/project-roles/matrix'
    );
    return response.data;
  },

  async saveProjectRoleMatrix(
    matrix: ProjectRolePermissionMatrix
  ): Promise<ProjectRoleMatrixResponse> {
    const response = await api.put<ProjectRoleMatrixResponse>(
      '/permissions/project-roles/matrix',
      { matrix }
    );
    return response.data;
  },

  async resetProjectRoleMatrix(): Promise<ProjectRoleMatrixResponse> {
    const response = await api.delete<ProjectRoleMatrixResponse>(
      '/permissions/project-roles/matrix'
    );
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
