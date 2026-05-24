import api from './api';
import type {
  CreateSpaceData,
  SpacePM,
  SpaceTreeNode,
  SpacesHierarchyResponse,
  TreeListNode,
  TreeProjectNode,
  TreeTaskNode,
} from '../types/hierarchy';

function normalizeTreeTaskNode(
  t: Record<string, unknown>,
  listDefaults?: {
    id_list: number;
    id_projet?: number;
    id_sprint?: number | null;
  }
): TreeTaskNode {
  const subtasksRaw = t.subtasks;
  const subtasks = Array.isArray(subtasksRaw)
    ? subtasksRaw.map((st) =>
        normalizeTreeTaskNode(st as Record<string, unknown>, listDefaults)
      )
    : undefined;
  const node: TreeTaskNode = {
    id_tache: Number(t.id_tache),
    nom_t: String(t.nom_t ?? t.nom ?? 'Tâche'),
    statut_t: (t.statut_t as string | null | undefined) ?? null,
    id_list: Number(t.id_list ?? listDefaults?.id_list ?? 0) || undefined,
    id_projet: (t.id_projet as number | undefined) ?? listDefaults?.id_projet,
    id_sprint:
      (t.id_sprint as number | null | undefined) ??
      listDefaults?.id_sprint ??
      null,
    id_parent_tache:
      t.id_parent_tache != null && t.id_parent_tache !== ''
        ? Number(t.id_parent_tache)
        : null,
    priorite_t: (t.priorite_t as string | null | undefined) ?? null,
    date_limite_t: (t.date_limite_t as string | null | undefined) ?? null,
  };
  if (subtasks && subtasks.length > 0) {
    return { ...node, subtasks };
  }
  return node;
}

function normalizeListNode(l: Record<string, unknown>): TreeListNode {
  const id_list = Number(l.id_list);
  const listDefaults = {
    id_list,
    id_projet: l.id_projet as number | undefined,
    id_sprint: (l.id_sprint as number | null | undefined) ?? null,
  };
  const tasks = Array.isArray(l.tasks)
    ? l.tasks
        .map((t) =>
          normalizeTreeTaskNode(t as Record<string, unknown>, listDefaults)
        )
        .filter((t) => !t.id_parent_tache)
    : [];
  return {
    id_list,
    nom: String(l.nom ?? 'Liste'),
    description: (l.description as string | null | undefined) ?? null,
    position: typeof l.position === 'number' ? l.position : 0,
    id_projet: Number(l.id_projet),
    id_sprint: (l.id_sprint as number | null | undefined) ?? null,
    task_count:
      typeof l.task_count === 'number' ? l.task_count : tasks.length,
    tasks,
  };
}

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

function normalizeProjectNode(p: Record<string, unknown>): TreeProjectNode {
  return {
    id_projet: Number(p.id_projet),
    nom_p: String(p.nom_p ?? p.nom ?? 'Projet'),
    description_p: p.description_p as string | undefined,
    id_space: (p.id_space as number | null | undefined) ?? null,
    sprints: Array.isArray(p.sprints)
      ? p.sprints.map((s) => {
          const sprint = s as Record<string, unknown>;
          const lists = Array.isArray(sprint.lists)
            ? sprint.lists.map((l) =>
                normalizeListNode(l as Record<string, unknown>)
              )
            : [];
          return {
            id_sprint: Number(sprint.id_sprint),
            nom_s: String(sprint.nom_s ?? 'Sprint'),
            id_projet: sprint.id_projet as number | undefined,
            lists,
            task_count:
              typeof sprint.task_count === 'number'
                ? sprint.task_count
                : lists.reduce(
                    (n, l) => n + (l.task_count ?? l.tasks?.length ?? 0),
                    0
                  ),
          };
        })
      : [],
    task_count: typeof p.task_count === 'number' ? p.task_count : 0,
    currentUserProjectRole:
      (p.currentUserProjectRole as string | null | undefined) ?? null,
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
