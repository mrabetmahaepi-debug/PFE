import api from './api';
import type {
  CreateSpaceData,
  SpacePM,
  SpaceTreeNode,
  SpacesHierarchyResponse,
  TreeProjectNode,
} from '../types/hierarchy';

function normalizeHierarchyPayload(data: unknown): SpacesHierarchyResponse {
  if (!data || typeof data !== 'object') return { spaces: [] };
  const raw = data as { spaces?: unknown };
  const spaces = Array.isArray(raw.spaces) ? raw.spaces : [];
  return {
    spaces: spaces.map((s: any) => ({
      id_space: Number(s.id_space),
      nom: s.nom ?? 'Espace',
      description: s.description ?? null,
      position: s.position ?? 0,
      projects: Array.isArray(s.projects)
        ? s.projects.map(normalizeProjectNode)
        : [],
    })),
  };
}

function normalizeProjectNode(p: any): TreeProjectNode {
  return {
    id_projet: Number(p.id_projet),
    nom_p: p.nom_p ?? p.nom ?? 'Projet',
    description_p: p.description_p,
    id_space: p.id_space ?? null,
    sprints: Array.isArray(p.sprints)
      ? p.sprints.map((s: any) => ({
          id_sprint: Number(s.id_sprint),
          nom_s: s.nom_s ?? 'Sprint',
          id_projet: s.id_projet,
          lists: Array.isArray(s.lists)
            ? s.lists.map((l: any) => ({
                id_list: Number(l.id_list),
                nom: l.nom ?? 'Liste',
                id_projet: l.id_projet,
                id_sprint: l.id_sprint,
                task_count: l.task_count,
                tasks: Array.isArray(l.tasks)
                  ? l.tasks.map((t: any) => ({
                      id_tache: Number(t.id_tache),
                      nom_t: t.nom_t ?? t.nom ?? 'Tâche',
                      statut_t: t.statut_t ?? null,
                      id_list: Number(t.id_list ?? l.id_list),
                      id_projet: t.id_projet ?? l.id_projet,
                      id_sprint: t.id_sprint ?? l.id_sprint,
                      priorite_t: t.priorite_t ?? null,
                      date_limite_t: t.date_limite_t ?? null,
                    }))
                  : [],
              }))
            : [],
          task_count: s.task_count,
        }))
      : [],
    task_count: p.task_count ?? 0,
    currentUserProjectRole: p.currentUserProjectRole ?? null,
    currentUserPermissions: Array.isArray(p.currentUserPermissions)
      ? p.currentUserPermissions.map(String)
      : [],
  };
}

export const spaceService = {
  async getHierarchy(): Promise<SpacesHierarchyResponse> {
    const response = await api.get('/spaces/hierarchy');
    return normalizeHierarchyPayload(response.data);
  },

  async list(): Promise<SpacePM[]> {
    const response = await api.get<SpacePM[]>('/spaces');
    return Array.isArray(response.data) ? response.data : [];
  },

  async getProjects(spaceId: number | string): Promise<TreeProjectNode[]> {
    const response = await api.get<{ projects?: TreeProjectNode[] }>(
      `/spaces/${spaceId}/projects`
    );
    const projects = response.data?.projects;
    return Array.isArray(projects)
      ? projects.map(normalizeProjectNode)
      : [];
  },

  async create(data: CreateSpaceData): Promise<SpacePM> {
    const response = await api.post<SpacePM>('/spaces', data);
    return response.data;
  },

  async update(
    id: number | string,
    data: Partial<CreateSpaceData>
  ): Promise<SpacePM> {
    const response = await api.put<SpacePM>(`/spaces/${id}`, data);
    return response.data;
  },

  async delete(id: number | string): Promise<void> {
    await api.delete(`/spaces/${id}`);
  },
};
