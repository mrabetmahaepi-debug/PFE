import api from './api';

export type TrashItemType = 'space' | 'project' | 'list';

export type WorkspaceTrashItem = {
  type: TrashItemType;
  id: number;
  name: string;
  deleted_at: string;
  spaceId?: number | null;
  folderId?: number | null;
};

export const workspaceTrashService = {
  async list(): Promise<WorkspaceTrashItem[]> {
    const response = await api.get<{ items?: WorkspaceTrashItem[] }>(
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
};
