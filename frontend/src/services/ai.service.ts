import api from './api';

export type TaskAssistantAction =
  | 'generate_description'
  | 'generate_subtasks'
  | 'summarize_task'
  | 'suggest_next_steps'
  | 'improve_title'
  | 'similar_tasks';

export type MemberTaskAssistantAction =
  | 'generate_description'
  | 'generate_subtasks'
  | 'summarize_task'
  | 'suggest_next_steps';

export type TaskAssistantRequest =
  | {
      taskId: number;
      action: MemberTaskAssistantAction;
    }
  | {
      taskTitle: string;
      taskDescription?: string;
      action: TaskAssistantAction;
    };

export type TaskAssistantResponse = {
  configured?: boolean;
  simulated?: boolean;
  action: TaskAssistantAction;
  provider?: 'groq' | 'openai' | 'simulated';
  description?: string;
  title?: string;
  subtasks?: string[];
  suggestions?: string[];
  summary?: string;
  steps?: string[];
  raw?: string;
  message?: string;
  code?: string;
};

export type TaskAssistantStatus = {
  configured: boolean;
  mode?: 'live' | 'simulated';
  actions: { action: TaskAssistantAction; label: string }[];
};

export const AI_NOT_CONFIGURED_MSG =
  'IA non configurée. Ajoutez GROQ_API_KEY ou OPENAI_API_KEY dans .env';

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
