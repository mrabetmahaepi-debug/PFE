import api from './api';

export type TaskAssistantAction =
  | 'generate_description'
  | 'generate_subtasks'
  | 'improve_title'
  | 'similar_tasks';

export type TaskAssistantRequest = {
  taskTitle: string;
  taskDescription?: string;
  action: TaskAssistantAction;
};

export type TaskAssistantResponse = {
  configured?: boolean;
  action: TaskAssistantAction;
  provider?: 'groq';
  description?: string;
  title?: string;
  subtasks?: string[];
  suggestions?: string[];
  raw?: string;
  message?: string;
  code?: string;
};

export type TaskAssistantStatus = {
  configured: boolean;
  actions: { action: TaskAssistantAction; label: string }[];
};

export const AI_NOT_CONFIGURED_MSG =
  'IA non configurée. Ajoutez une clé API gratuite dans .env';

export const aiService = {
  async getStatus(): Promise<TaskAssistantStatus> {
    const res = await api.get<TaskAssistantStatus>('/ai/task-assistant/status');
    return res.data;
  },

  async taskAssistant(body: TaskAssistantRequest): Promise<TaskAssistantResponse> {
    const res = await api.post<TaskAssistantResponse>('/ai/task-assistant', body);
    return res.data;
  },
};
