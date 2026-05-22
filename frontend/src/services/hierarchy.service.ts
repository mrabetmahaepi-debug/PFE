import api from './api';
import type {
  ListDetail,
  ListPM,
  ListStatusPM,
  ProjectTree,
  TreeListNode,
  TreeSprintNode,
  CreateListData,
} from '../types/hierarchy';
import type { Tache } from '../types/task';

const pickLabel = (
  obj: any,
  ...keys: string[]
): string => {
  if (!obj) return '';
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return '';
};

const PROJECT_NAME_KEYS = ['nom_p', 'nom', 'titre', 'name', 'nom_projet'];
const GENERIC_NAME_KEYS = ['nom', 'name', 'titre', 'label'];
const SPRINT_NAME_KEYS = ['nom_s', 'nom', 'name', 'titre'];

const normalizeList = (l: any): TreeListNode => ({
  ...l,
  id_list: Number(l.id_list ?? l.id),
  nom: pickLabel(l, ...GENERIC_NAME_KEYS) || `Liste #${l.id_list ?? l.id}`,
  task_count: typeof l.task_count === 'number' ? l.task_count : undefined,
});

const normalizeSprint = (s: any): TreeSprintNode => ({
  id_sprint: Number(s.id_sprint ?? s.id),
  nom_s:
    pickLabel(s, ...SPRINT_NAME_KEYS) || `Sprint #${s.id_sprint ?? s.id}`,
  date_debut_s: s.date_debut_s,
  date_fin_s: s.date_fin_s,
  id_projet: s.id_projet ?? null,
  lists: Array.isArray(s.lists) ? s.lists.map(normalizeList) : [],
  task_count: typeof s.task_count === 'number' ? s.task_count : undefined,
});

const normalizeTree = (raw: any, fallbackId?: number | string): ProjectTree => {
  if (!raw || typeof raw !== 'object') {
    return {
      id_projet: Number(fallbackId) || 0,
      nom_p: '',
      groups: [],
      folders: [],
      sprints: [],
      lists: [],
      task_count: 0,
    };
  }

  const projectSource = raw.project ?? raw;
  const idCandidate =
    raw.id_projet ??
    projectSource?.id_projet ??
    projectSource?.id ??
    fallbackId;
  const id_projet = Number(idCandidate) || 0;
  const nom_p =
    pickLabel(raw, ...PROJECT_NAME_KEYS) ||
    pickLabel(projectSource, ...PROJECT_NAME_KEYS) ||
    `Projet #${id_projet}`;
  const description_p =
    raw.description_p ??
    projectSource?.description_p ??
    projectSource?.description ??
    '';

  return {
    ...projectSource,
    id_projet,
    nom_p,
    description_p,
    id_space: raw.id_space ?? projectSource?.id_space ?? null,
    currentUserProjectRole:
      raw.currentUserProjectRole ??
      projectSource?.currentUserProjectRole ??
      null,
    currentUserPermissions: Array.isArray(raw.currentUserPermissions)
      ? raw.currentUserPermissions.map(String)
      : Array.isArray(projectSource?.currentUserPermissions)
        ? projectSource.currentUserPermissions.map(String)
        : [],
    groups: [],
    folders: [],
    sprints: Array.isArray(raw.sprints) ? raw.sprints.map(normalizeSprint) : [],
    lists: [],
    task_count:
      typeof raw.task_count === 'number'
        ? raw.task_count
        : Array.isArray(raw.tasks)
          ? raw.tasks.length
          : 0,
  };
};

export const hierarchyService = {
  normalizeTree,

  async getTree(projectId: number | string): Promise<ProjectTree> {
    const response = await api.get(`/projets/${projectId}/tree`);
    return normalizeTree(response.data, projectId);
  },

  async getListById(id: number | string): Promise<ListDetail> {
    const response = await api.get<ListDetail>(`/lists/${id}`);
    return response.data;
  },

  async getListTasks(id: number | string): Promise<Tache[]> {
    const response = await api.get<{ tasks?: Tache[] }>(`/lists/${id}/tasks`);
    const raw = response.data?.tasks ?? response.data;
    return Array.isArray(raw) ? raw : [];
  },

  async getListStatuses(id: number | string): Promise<ListStatusPM[]> {
    const response = await api.get<{ statuses?: ListStatusPM[] }>(
      `/lists/${id}/statuses`
    );
    const raw = response.data?.statuses ?? response.data;
    return Array.isArray(raw) ? raw : [];
  },

  async createListStatus(
    id: number | string,
    label: string
  ): Promise<ListStatusPM> {
    const response = await api.post<{ status: ListStatusPM }>(
      `/lists/${id}/statuses`,
      { label }
    );
    return response.data.status ?? response.data;
  },

  async listLists(projectId: number | string): Promise<ListPM[]> {
    const response = await api.get<ListPM[]>(`/lists/projet/${projectId}`);
    return response.data;
  },
  async createList(data: CreateListData): Promise<ListPM> {
    const response = await api.post<ListPM>('/lists', data);
    return response.data;
  },
  async updateList(
    id: number | string,
    data: Partial<CreateListData>
  ): Promise<ListPM> {
    const response = await api.put<ListPM>(`/lists/${id}`, data);
    return response.data;
  },
  async deleteList(id: number | string): Promise<void> {
    await api.delete(`/lists/${id}`);
  },
};
