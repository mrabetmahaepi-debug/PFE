import api from './api';
import {
  type Tache,
  type CreateTaskData,
  TaskStatus,
  normalizeTaskPriority,
} from '../types/task';

import { normalizeTaskStatutKey } from '../lib/listStatusGroups';
import type { TaskComment, TaskHistoryEntry } from '../types/taskActivity';
import { dispatchProjectTaskStatsChanged } from '../lib/workspaceEvents';

const normalizeTask = (task: Tache): Tache => {
  const raw = String(task.statut_t ?? '').trim();
  const key = normalizeTaskStatutKey(raw || task.statut_t);
  const subtasks = Array.isArray(task.subtasks)
    ? task.subtasks.map(normalizeTask)
    : undefined;
  return {
    ...task,
    priorite_t: normalizeTaskPriority(task.priorite_t),
    statut_t: key,
    subtasks,
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
      startDate?: string;
      endDate?: string;
      date_debut_t?: string;
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
      date_debut_t: data.date_debut_t ?? data.startDate,
      startDate: data.date_debut_t ?? data.startDate,
      date_limite_t: data.date_limite_t ?? data.dueDate ?? data.endDate,
      dueDate: data.date_limite_t ?? data.dueDate ?? data.endDate,
      endDate: data.date_limite_t ?? data.dueDate ?? data.endDate,
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
      const task = normalizeTask(payloadOut);
      dispatchProjectTaskStatsChanged({
        projectId: task.id_projet ?? projectId ?? undefined,
      });
      return task;
    } catch (err: unknown) {
      const ax = err as { response?: { data?: unknown }; message?: string };
      console.log('createTask error', ax?.response?.data ?? ax?.message ?? err);
      throw err;
    }
  },

  async update(id: string, data: Partial<CreateTaskData>): Promise<Tache> {
    try {
      const response = await api.patch<{ task: Tache }>(`/tasks/${id}`, data);
      const payload = (response.data as { task?: Tache }).task ?? response.data;
      const task = normalizeTask(payload as Tache);
      dispatchProjectTaskStatsChanged({ projectId: task.id_projet ?? undefined });
      return task;
    } catch {
      const response = await api.put<Tache>(`/taches/${id}`, data);
      const payload = (response.data as { task?: Tache }).task ?? response.data;
      const task = normalizeTask(payload as Tache);
      dispatchProjectTaskStatsChanged({ projectId: task.id_projet ?? undefined });
      return task;
    }
  },

  async getComments(taskId: string | number): Promise<TaskComment[]> {
    const id = Number(taskId);
    if (!Number.isFinite(id) || id < 1) return [];
    try {
      const response = await api.get<TaskComment[]>(`/tasks/${id}/comments`);
      return response.data ?? [];
    } catch (err) {
      console.warn('getComments /tasks failed, trying /taches', err);
      const response = await api.get<TaskComment[]>(`/taches/${id}/comments`);
      return response.data ?? [];
    }
  },

  async postComment(taskId: string | number, content: string): Promise<TaskComment> {
    const id = Number(taskId);
    const text = String(content ?? '').trim();
    if (!Number.isFinite(id) || id < 1) {
      throw new Error('ID de tâche invalide');
    }
    if (!text) {
      throw new Error('Le commentaire ne peut pas être vide');
    }
    const post = async (path: string) => {
      const response = await api.post<TaskComment>(path, { content: text });
      return response.data;
    };

    try {
      return await post(`/tasks/${id}/comments`);
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number } };
      if (ax.response?.status === 404) {
        return post(`/taches/${id}/comments`);
      }
      throw err;
    }
  },

  async createSubtasks(
    parentTaskId: number,
    titles: string[]
  ): Promise<Tache[]> {
    const response = await api.post<{ subtasks: Tache[] }>(
      `/tasks/${parentTaskId}/subtasks`,
      { titles }
    );
    const rows = response.data?.subtasks ?? [];
    const normalized = rows.map(normalizeTask);
    const pid = normalized[0]?.id_projet;
    dispatchProjectTaskStatsChanged({ projectId: pid ?? undefined });
    return normalized;
  },

  async getHistory(taskId: string | number): Promise<TaskHistoryEntry[]> {
    const response = await api.get<TaskHistoryEntry[]>(`/tasks/${taskId}/history`);
    return response.data ?? [];
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
      const task = normalizeTask(out as Tache);
      dispatchProjectTaskStatsChanged({ projectId: task.id_projet ?? undefined });
      return task;
    } catch (err: unknown) {
      const ax = err as { response?: { data?: unknown } };
      console.log('patchTask status error', ax?.response?.data ?? err);
      const response = await api.patch<{ task: Tache }>(`/taches/${id}`, payload);
      const out = (response.data as { task?: Tache }).task ?? response.data;
      const task = normalizeTask(out as Tache);
      dispatchProjectTaskStatsChanged({ projectId: task.id_projet ?? undefined });
      return task;
    }
  },

  async delete(id: string | number): Promise<void> {
    const sid = String(id);
    try {
      await api.delete(`/tasks/${sid}`);
    } catch {
      await api.delete(`/taches/${sid}`);
    }
    dispatchProjectTaskStatsChanged();
  },

  async assign(taskId: string | number, userId: number): Promise<Tache> {
    const response = await api.patch<{ task: Tache }>(`/taches/${taskId}/assigner`, {
      id_utilisateur: userId,
    });
    const out = (response.data as { task?: Tache }).task ?? response.data;
    return normalizeTask(out as Tache);
  },
};
