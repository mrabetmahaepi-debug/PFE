import api from './api';

export type UserAccessProjectRow = {
  id: number;
  name: string;
  hasAccess: boolean;
  denied: boolean;
  roleProjet: string | null;
  sprints: Array<{ id: number; name: string; granted: boolean }>;
  lists: Array<{ id: number; name: string; granted: boolean }>;
  tasks: Array<{ id: number; name: string; granted: boolean }>;
};

export type UserAccessFeatureRow = {
  key: string;
  label: string;
  granted: boolean;
  denied: boolean;
};

export type UserAccessSnapshot = {
  userId: number;
  poste: string | null;
  projects: UserAccessProjectRow[];
  features: UserAccessFeatureRow[];
};

export type SaveUserAccessPayload = {
  projects: Array<{
    projectId: number;
    enabled: boolean;
    roleProjet?: string | null;
    sprints?: Array<{ id: number; granted: boolean }>;
    lists?: Array<{ id: number; granted: boolean }>;
    tasks?: Array<{ id: number; granted: boolean }>;
  }>;
  features?: Array<{ key: string; granted: boolean }>;
};

export const userAccessService = {
  async getUserAccess(userId: number | string): Promise<UserAccessSnapshot> {
    const response = await api.get<UserAccessSnapshot>(
      `/me/admin/users/${userId}/access`
    );
    return response.data;
  },

  async saveUserAccess(
    userId: number | string,
    payload: SaveUserAccessPayload
  ): Promise<void> {
    await api.put(`/me/admin/users/${userId}/access`, payload);
  },
};
