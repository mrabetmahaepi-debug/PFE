import api from './api';
import { dispatchProjectTaskStatsChanged } from '../lib/workspaceEvents';

export type TrashItemType = 'space' | 'project' | 'list';

export type MemberTrashItemType = 'task' | 'subtask' | 'list' | 'sprint';

export type WorkspaceTrashItem = {
  type: TrashItemType;
  id: number;
  name: string;
  deleted_at: string;
  spaceId?: number | null;
  folderId?: number | null;
};

export type MemberWorkspaceTrashItem = {
  type: MemberTrashItemType;
  id: number;
  name: string;
  deleted_at: string;
  deleted_by: number | null;
  deleted_by_name: string;
  id_projet?: number | null;
  id_sprint?: number | null;
  id_list?: number | null;
};

export const workspaceTrashService = {
  async list(): Promise<WorkspaceTrashItem[]> {
    const response = await api.get<{ items?: WorkspaceTrashItem[] }>(
      '/spaces/trash'
    );
    return Array.isArray(response.data?.items) ? response.data.items : [];
  },

  async listMember(): Promise<MemberWorkspaceTrashItem[]> {
    const response = await api.get<{ items?: MemberWorkspaceTrashItem[] }>(
      '/spaces/trash'
    );
    return Array.isArray(response.data?.items) ? response.data.items : [];
  },

  async trashSpace(id: number): Promise<void> {
    await api.post(`/spaces/${id}/trash`);
  },

  async restoreSpace(id: number): Promise<void> {
    await api.post(`/spaces/${id}/restore`);
  },

  async deleteSpacePermanent(id: number): Promise<void> {
    await api.delete(`/spaces/${id}`);
  },

  async trashProject(id: number): Promise<void> {
    await api.post(`/projets/${id}/trash`);
  },

  async restoreProject(id: number): Promise<void> {
    await api.post(`/projets/${id}/restore`);
  },

  async deleteProjectPermanent(id: number): Promise<void> {
    await api.delete(`/projets/${id}`);
  },

  async trashList(id: number): Promise<void> {
    await api.post(`/lists/${id}/trash`);
  },

  async restoreList(id: number): Promise<void> {
    await api.post(`/lists/${id}/restore`);
  },

  async deleteListPermanent(id: number): Promise<void> {
    await api.delete(`/lists/${id}`);
  },

  async restoreTask(id: number): Promise<void> {
    await api.post(`/taches/${id}/restore`);
    dispatchProjectTaskStatsChanged();
  },

  async deleteTaskPermanent(id: number): Promise<void> {
    await api.delete(`/taches/${id}/permanent`);
    dispatchProjectTaskStatsChanged();
  },

  async restoreSprint(id: number): Promise<void> {
    await api.post(`/sprints/${id}/restore`);
  },

  async deleteSprintPermanent(id: number): Promise<void> {
    await api.delete(`/sprints/${id}/permanent`);
  },
};
