import api from './api';

export type CreateSidebarFolderPayload = {
  spaceId: number;
  name: string;
};

export type CreateSidebarListPayload = {
  spaceId: number;
  folderId: number | null;
  name: string;
};

export type SidebarFolderResponse = {
  folderId?: number;
  id_folder?: number;
  id_projet?: number;
  spaceId?: number;
  name?: string;
  nom?: string;
};

export type SidebarListResponse = {
  id_list?: number;
  folderId?: number | null;
  spaceId?: number;
  name?: string;
  nom?: string;
};

export type CreateSidebarTaskPayload = {
  listId: number;
  title: string;
  status?: string;
  projectId?: number;
};

export const sidebarCreateService = {
  async createFolder(payload: CreateSidebarFolderPayload): Promise<SidebarFolderResponse> {
    console.log('create payload', payload);
    const response = await api.post<SidebarFolderResponse>('/folders', payload);
    console.log('api response', response.data);
    return response.data;
  },

  async createList(payload: CreateSidebarListPayload): Promise<SidebarListResponse> {
    console.log('create payload', payload);
    const response = await api.post<SidebarListResponse>('/lists', payload);
    console.log('api response', response.data);
    return response.data;
  },

  async createTask(payload: CreateSidebarTaskPayload) {
    const response = await api.post('/tasks', {
      listId: payload.listId,
      title: payload.title,
      status: payload.status ?? 'À faire',
      projectId: payload.projectId,
    });
    return response.data;
  },
};
