import api from './api';

export interface ConversationParticipant {
  id_participant: number;
  id_utilisateur: number;
  isAdmin: boolean;
  utilisateur: { nom: string | null; prenom: string | null; email: string | null; };
}

export interface MeetingMetadata {
  titre: string;
  date: string;
  lien: string;
  description?: string;
}

export interface ChatMessage {
  id_message: number;
  id_conversation: number;
  id_expediteur: number;
  contenu: string;
  type: 'text' | 'meeting';
  metadata: string | null;
  createdAt: string;
  expediteur: { id_utilisateur: number; nom: string | null; prenom: string | null; };
}

export interface Conversation {
  id_conversation: number;
  nom: string | null;
  is_group: boolean;
  is_system: boolean;
  createdAt: string;
  updatedAt: string;
  participants: ConversationParticipant[];
  messages: ChatMessage[];
}

export const messagingService = {
  getConversations: async (): Promise<Conversation[]> => {
    const res = await api.get('/messaging/conversations');
    return res.data;
  },

  getMessages: async (conversationId: number): Promise<ChatMessage[]> => {
    const res = await api.get(`/messaging/conversations/${conversationId}/messages`);
    return res.data;
  },

  sendTextMessage: async (conversationId: number, contenu: string): Promise<ChatMessage> => {
    const res = await api.post(`/messaging/conversations/${conversationId}/messages`, {
      contenu,
      type: 'text'
    });
    return res.data;
  },

  sendMeetingMessage: async (
    conversationId: number,
    metadata: MeetingMetadata
  ): Promise<ChatMessage> => {
    const res = await api.post(`/messaging/conversations/${conversationId}/messages`, {
      contenu: `📅 Réunion: ${metadata.titre}`,
      type: 'meeting',
      metadata
    });
    return res.data;
  }
};
