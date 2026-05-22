import api from './api';

export interface ConversationParticipant {
  id_participant: number;
  id_utilisateur: number;
  isAdmin: boolean;
  utilisateur: { nom: string | null; prenom: string | null; email: string | null };
}

export interface MeetingMetadata {
  titre: string;
  date: string;
  lien: string;
  description?: string;
}

export interface MessageReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface ChatMessage {
  id_message: number;
  id_conversation: number;
  id_expediteur: number;
  contenu: string;
  type: 'text' | 'meeting' | 'image' | 'file' | 'voice';
  metadata: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  attachmentType?: string | null;
  attachmentSize?: number | null;
  /** Même valeur que `attachmentUrl` pour les messages `voice` (URL relative stockée). */
  audioUrl?: string | null;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  /** Présent lorsque le message a été supprimé (contenu masqué côté API). */
  deleted?: boolean;
  reactions?: MessageReactionSummary[];
  expediteur: { id_utilisateur: number; nom: string | null; prenom: string | null };
}

export interface Conversation {
  id_conversation: number;
  nom: string | null;
  description?: string | null;
  id_entreprise?: number | null;
  created_by_id?: number | null;
  is_group: boolean;
  is_system: boolean;
  createdAt: string;
  updatedAt: string;
  participants: ConversationParticipant[];
  messages: ChatMessage[];
}

export interface MessagingTeamMember {
  id_utilisateur: number;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  globalRole: string | null;
  projectRoles: { id_projet: number; nom_p: string; role_projet: string }[];
  isChefDeProjet: boolean;
  /** Présent pour la liste globale des admins (messagerie super admin). */
  entrepriseNom?: string | null;
}

export interface CreateDiscussionPayload {
  nom: string;
  description?: string;
  /** Messagerie admin d’entreprise : sélection manuelle (+ chefs si case cochée). */
  participantIds?: number[];
  addAllChefs?: boolean;
  entrepriseId?: number;
  /** Messagerie super admin : uniquement des administrateurs d’entreprise (rôle global). */
  selectedAdminIds?: number[];
}

export interface UpdateDiscussionPayload {
  name: string;
  description?: string;
}

export interface CreateDiscussionMeetingPayload {
  title: string;
  meetingDate: string;
  meetingLink: string;
  description?: string;
}

export interface GetConversationsResponse {
  conversations: Conversation[];
}

function normalizeConversationsPayload(data: unknown): Conversation[] {
  if (Array.isArray(data)) {
    return data as Conversation[];
  }
  if (
    data &&
    typeof data === 'object' &&
    Array.isArray((data as GetConversationsResponse).conversations)
  ) {
    return (data as GetConversationsResponse).conversations;
  }
  return [];
}

function voiceExtFromBlobType(t: string): string {
  const u = (t || '').toLowerCase();
  if (u.includes('webm')) return 'webm';
  if (u.includes('ogg')) return 'ogg';
  if (u.includes('mpeg') || u.includes('mp3')) return 'mp3';
  if (u.includes('wav')) return 'wav';
  if (u.includes('mp4') || u.includes('m4a')) return 'm4a';
  return 'webm';
}

export const messagingService = {
  getConversations: async (): Promise<Conversation[]> => {
    const res = await api.get<unknown>('/messaging/conversations');
    return normalizeConversationsPayload(res.data);
  },

  getConversation: async (conversationId: number): Promise<Conversation> => {
    const res = await api.get<Conversation>(`/messaging/conversations/${conversationId}`);
    return res.data;
  },

  getTeamMembers: async (entrepriseId?: number): Promise<MessagingTeamMember[]> => {
    const q =
      entrepriseId != null && Number.isFinite(Number(entrepriseId))
        ? `?entrepriseId=${encodeURIComponent(String(entrepriseId))}`
        : '';
    const res = await api.get<MessagingTeamMember[]>(
      `/messaging/conversations/team-members${q}`
    );
    return res.data;
  },

  createDiscussion: async (payload: CreateDiscussionPayload): Promise<Conversation> => {
    const res = await api.post<Conversation>('/messaging/conversations', payload);
    return res.data;
  },

  addParticipants: async (
    conversationId: number,
    userIds: number[]
  ): Promise<Conversation> => {
    const res = await api.post<Conversation>(
      `/messaging/conversations/${conversationId}/participants`,
      { userIds }
    );
    return res.data;
  },

  removeParticipant: async (
    conversationId: number,
    userId: number
  ): Promise<Conversation> => {
    const res = await api.delete<Conversation>(
      `/messaging/conversations/${conversationId}/participants/${userId}`
    );
    return res.data;
  },

  deleteDiscussion: async (conversationId: number): Promise<void> => {
    await api.delete(`/messaging/conversations/${conversationId}`);
  },

  updateDiscussion: async (
    conversationId: number,
    payload: UpdateDiscussionPayload
  ): Promise<Conversation> => {
    const res = await api.patch<Conversation>(
      `/messaging/conversations/${conversationId}`,
      payload
    );
    return res.data;
  },

  createDiscussionMeeting: async (
    conversationId: number,
    payload: CreateDiscussionMeetingPayload
  ): Promise<ChatMessage> => {
    const res = await api.post<ChatMessage>(
      `/messaging/conversations/${conversationId}/meetings`,
      payload
    );
    return res.data;
  },

  getMessages: async (conversationId: number): Promise<ChatMessage[]> => {
    const res = await api.get<ChatMessage[]>(`/messaging/conversations/${conversationId}/messages`);
    return res.data;
  },

  sendTextMessage: async (conversationId: number, contenu: string): Promise<ChatMessage> => {
    const res = await api.post<ChatMessage>(`/messaging/conversations/${conversationId}/messages`, {
      contenu,
      type: 'text',
    });
    return res.data;
  },

  sendMessageWithAttachment: async (
    conversationId: number,
    formData: FormData
  ): Promise<ChatMessage> => {
    const res = await api.post<ChatMessage>(
      `/messaging/conversations/${conversationId}/messages/attachment`,
      formData
    );
    return res.data;
  },

  /**
   * Message vocal : POST multipart sur `.../messages/attachment`.
   * Champs : `file`, `type` / `messageType` = voice, `content` optionnel (vide).
   */
  sendVoiceMessage: async (conversationId: number, blob: Blob): Promise<ChatMessage> => {
    if (!blob.size) {
      throw new Error('Message vocal vide.');
    }
    const ext = voiceExtFromBlobType(blob.type || 'audio/webm');
    const mimeType = ext === 'webm' ? 'audio/webm' : blob.type || `audio/${ext}`;
    const filename = `voice-message-${Date.now()}.${ext}`;
    const file = new File([blob], filename, { type: mimeType });
    const fd = new FormData();
    fd.append('content', '');
    fd.append('type', 'voice');
    fd.append('messageType', 'voice');
    fd.append('file', file, filename);
    const res = await api.post<ChatMessage>(
      `/messaging/conversations/${conversationId}/messages/attachment`,
      fd
    );
    return res.data;
  },

  sendMeetingMessage: async (
    conversationId: number,
    metadata: MeetingMetadata
  ): Promise<ChatMessage> => {
    const res = await api.post<ChatMessage>(`/messaging/conversations/${conversationId}/messages`, {
      contenu: `📅 Réunion: ${metadata.titre}`,
      type: 'meeting',
      metadata,
    });
    return res.data;
  },

  deleteMessage: async (conversationId: number, messageId: number): Promise<ChatMessage> => {
    const res = await api.delete<ChatMessage>(
      `/messaging/conversations/${conversationId}/messages/${messageId}`
    );
    return res.data;
  },

  updateMessage: async (
    conversationId: number,
    messageId: number,
    content: string
  ): Promise<ChatMessage> => {
    const res = await api.patch<ChatMessage>(
      `/messaging/conversations/${conversationId}/messages/${messageId}`,
      { content }
    );
    return res.data;
  },

  toggleMessageReaction: async (
    conversationId: number,
    messageId: number,
    emoji: string
  ): Promise<MessageReactionSummary[]> => {
    const res = await api.post<{ reactions: MessageReactionSummary[] }>(
      `/messaging/conversations/${conversationId}/messages/${messageId}/reactions`,
      { emoji }
    );
    return res.data.reactions;
  },
};
