import api from './api';
import {
  type Tache,
  type CreateTaskData,
  TaskStatus,
  normalizeTaskPriority,
} from '../types/task';

const STATUS_MAP: Record<string, TaskStatus> = {
  todo: TaskStatus.TODO,
  TODO: TaskStatus.TODO,
  en_cours: TaskStatus.IN_PROGRESS,
  EN_COURS: TaskStatus.IN_PROGRESS,
  IN_PROGRESS: TaskStatus.IN_PROGRESS,
  terminee: TaskStatus.DONE,
  TERMINEE: TaskStatus.DONE,
  DONE: TaskStatus.DONE,
};

const normalizeTask = (task: Tache): Tache => {
  const raw = String(task.statut_t ?? '').trim();
  const mapped = STATUS_MAP[raw] ?? STATUS_MAP[raw.toLowerCase()];
  return {
    ...task,
    priorite_t: normalizeTaskPriority(task.priorite_t),
    statut_t: mapped ?? raw,
  };
};

const normalizeTasks = (tasks: Tache[]): Tache[] => tasks.map(normalizeTask);

export const taskService = {
  async getByProject(projectId: string): Promise<Tache[]> {
    const response = await api.get<Tache[]>(`/taches/projet/${projectId}`);
    return normalizeTasks(response.data);
  },

  async getMyTasks(): Promise<Tache[]> {
    const response = await api.get<Tache[]>('/taches/mes-taches');
    return normalizeTasks(response.data);
  },

  /** GET /tasks/:taskId — single task for the details page */
  async getById(id: string | number): Promise<Tache> {
    try {
      const response = await api.get<Tache>(`/tasks/${id}`);
      const payload = (response.data as { task?: Tache }).task ?? response.data;
      return normalizeTask(payload as Tache);
    } catch {
      const response = await api.get<Tache>(`/taches/${id}`);
      const payload = (response.data as { task?: Tache }).task ?? response.data;
      return normalizeTask(payload as Tache);
    }
  },

  async create(
    data: CreateTaskData & {
      title?: string;
      projectId?: number;
      sprintId?: number | null;
      listId?: number | null;
      spaceId?: number | null;
      assigneeId?: number | null;
      status?: TaskStatus;
      dueDate?: string;
    }
  ): Promise<Tache> {
    const listId = data.id_list ?? data.listId ?? null;
    const projectId = data.id_projet ?? data.projectId ?? null;
    const sprintId = data.id_sprint ?? data.sprintId ?? null;
    const payload = {
      title: data.nom_t ?? data.title,
      nom_t: data.nom_t ?? data.title,
      description: data.description_t ?? '',
      description_t: data.description_t ?? '',
      priorite_t: data.priorite_t,
      statut_t: data.statut_t ?? data.status,
      status: data.statut_t ?? data.status,
      date_limite_t: data.date_limite_t ?? data.dueDate,
      dueDate: data.date_limite_t ?? data.dueDate,
      listId,
      id_list: listId,
      projectId,
      id_projet: projectId,
      sprintId,
      id_sprint: sprintId,
      spaceId: data.spaceId ?? null,
      id_space: data.spaceId ?? null,
      assigneeId: data.assigne_a ?? data.assigneeId ?? null,
      assigne_a: data.assigne_a ?? data.assigneeId ?? null,
    };
    console.log('createTask payload', payload);
    try {
      const response = await api.post<Tache>('/tasks', payload);
      console.log('createTask response', response.data);
      const payloadOut = (response.data as any).task ?? response.data;
      return normalizeTask(payloadOut);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: unknown }; message?: string };
      console.log('createTask error', ax?.response?.data ?? ax?.message ?? err);
      throw err;
    }
  },

  async update(id: string, data: Partial<CreateTaskData>): Promise<Tache> {
    const response = await api.put<Tache>(`/taches/${id}`, data);
    const payload = (response.data as any).task ?? response.data;
    return normalizeTask(payload);
  },

  async updateStatus(id: string, status: TaskStatus): Promise<Tache> {
    return this.patchStatus(id, status);
  },

  /** PATCH /tasks/:id — update status (list-scoped statut_key) */
  async patchStatus(id: string, status: string): Promise<Tache> {
    const payload = { status, statut_t: status };
    console.log('patchTask status payload', { id, ...payload });
    try {
      const response = await api.patch<{ task: Tache }>(`/tasks/${id}`, payload);
      console.log('patchTask status response', response.data);
      const out = (response.data as { task?: Tache }).task ?? response.data;
      return normalizeTask(out as Tache);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: unknown } };
      console.log('patchTask status error', ax?.response?.data ?? err);
      const response = await api.patch<{ task: Tache }>(`/taches/${id}`, payload);
      const out = (response.data as { task?: Tache }).task ?? response.data;
      return normalizeTask(out as Tache);
    }
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/taches/${id}`);
  }
};
