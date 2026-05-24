import api from './api';

export type EquipePermissionRow = {
  key: string;
  label: string;
  enabled: boolean;
};

export type EquipeResourceRow = {
  id: number;
  name: string;
  granted: boolean;
};

export type ProjectEquipeMember = {
  userId: number;
  prenom: string;
  nom: string;
  email: string;
  roleProjet: string;
  assignedTaskCount: number;
  permissions: EquipePermissionRow[];
  sprints: EquipeResourceRow[];
  lists: EquipeResourceRow[];
  tasks: EquipeResourceRow[];
};

export type ProjectEquipeSnapshot = {
  projectId: number;
  projectName: string;
  members: ProjectEquipeMember[];
};

export type ManagedProject = {
  id: number;
  name: string;
};

export const projectTeamAccessService = {
  async getManagedProjects(): Promise<ManagedProject[]> {
    const { data } = await api.get<{ projects: ManagedProject[] }>(
      '/projets/managed/mine'
    );
    return data.projects ?? [];
  },

  async getEquipe(projectId: number): Promise<ProjectEquipeSnapshot> {
    const { data } = await api.get<ProjectEquipeSnapshot>(
      `/projets/${projectId}/equipe`
    );
    return data;
  },

  async saveMemberEquipe(
    projectId: number,
    userId: number,
    payload: {
      roleProjet?: string;
      permissions: EquipePermissionRow[];
      sprints?: EquipeResourceRow[];
      lists?: EquipeResourceRow[];
      tasks?: EquipeResourceRow[];
    }
  ): Promise<ProjectEquipeSnapshot> {
    const { data } = await api.put<ProjectEquipeSnapshot>(
      `/projets/${projectId}/equipe/${userId}`,
      {
        roleProjet: payload.roleProjet,
        permissions: payload.permissions.map((p) => ({
          key: p.key,
          enabled: p.enabled,
        })),
        sprints: payload.sprints?.map((s) => ({
          id: s.id,
          granted: s.granted,
        })),
        lists: payload.lists?.map((l) => ({ id: l.id, granted: l.granted })),
        tasks: payload.tasks?.map((t) => ({ id: t.id, granted: t.granted })),
      }
    );
    return data;
  },

  async addMember(
    projectId: number,
    payload: { userId: number; profilePoste: string }
  ): Promise<ProjectEquipeSnapshot> {
    const { data } = await api.post<ProjectEquipeSnapshot>(
      `/projets/${projectId}/equipe/members`,
      payload
    );
    return data;
  },
};
