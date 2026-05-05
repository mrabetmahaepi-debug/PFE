import api from './api';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string;
}

export const chatbotService = {
  async sendMessage(message: string): Promise<{ response: string }> {
    const response = await api.post<{ response: string }>('/chatbot', { message });
    return response.data;
  }
};
