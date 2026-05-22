import api from "./api";

export interface MePermissionEntry {
  name: string;
  description: string;
  systemOnly: boolean;
}

export interface MePermissionGroup {
  id: string;
  label: string;
  description: string;
  permissions: MePermissionEntry[];
}

export interface MePermissionsResponse {
  role: string | null;
  id_role: number | null;
  id_entreprise: number | null;
  isSuperAdmin: boolean;
  permissions: string[];
  groups: MePermissionGroup[];
}

export interface PermissionDefinition extends MePermissionEntry {
  category: string;
}

export interface PermissionsCatalogResponse {
  permissions: PermissionDefinition[];
  groups: MePermissionGroup[];
}

export const meService = {
  async getPermissions(): Promise<MePermissionsResponse> {
    const response = await api.get<MePermissionsResponse>("/me/permissions");
    return response.data;
  },

  async getCatalog(): Promise<PermissionsCatalogResponse> {
    const response = await api.get<PermissionsCatalogResponse>(
      "/me/permissions/catalog"
    );
    return response.data;
  },
};
