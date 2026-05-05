import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Send, Video, Users, Calendar,
  ExternalLink, X, Loader2, Clock, Link2
} from 'lucide-react';
import { messagingService, type Conversation, type ChatMessage, type MeetingMetadata, type ConversationParticipant } from '../services/messaging.service';
import { useAuth } from '../hooks/useAuth';
import BackButton from '../components/BackButton';
import './Messages.css';

/* ─── Meeting Form Modal ──────────────────────────────────────────── */
interface MeetingFormProps {
  onClose: () => void;
  onSend: (meta: MeetingMetadata) => void;
}

const MeetingForm: React.FC<MeetingFormProps> = ({ onClose, onSend }) => {
  const [titre, setTitre] = useState('');
  const [date, setDate] = useState('');
  const [lien, setLien] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre.trim() || !date || !lien.trim()) return;
    onSend({ titre, date, lien, description });
  };

  return (
    <div className="meeting-modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="meeting-modal"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
      >
        <div className="meeting-modal-header">
          <div className="meeting-modal-title">
            <Video size={20} />
            <h3>Créer une réunion</h3>
          </div>
          <button className="meeting-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="meeting-form">
          <div className="meeting-form-group">
            <label htmlFor="meeting-title">Titre de la réunion *</label>
            <input
              id="meeting-title"
              type="text"
              placeholder="ex: Réunion mensuelle des admins"
              value={titre}
              onChange={e => setTitre(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="meeting-form-group">
            <label htmlFor="meeting-date"><Clock size={14} /> Date & heure *</label>
            <input
              id="meeting-date"
              type="datetime-local"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>
          <div className="meeting-form-group">
            <label htmlFor="meeting-link"><Link2 size={14} /> Lien Google Meet / Zoom *</label>
            <input
              id="meeting-link"
              type="url"
              placeholder="https://meet.google.com/..."
              value={lien}
              onChange={e => setLien(e.target.value)}
              required
            />
          </div>
          <div className="meeting-form-group">
            <label htmlFor="meeting-desc">Description (optionnel)</label>
            <textarea
              id="meeting-desc"
              placeholder="Ordre du jour, notes..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="meeting-form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-send-meeting">
              <Video size={16} />
              Envoyer la réunion
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

/* ─── Meeting Message Card ────────────────────────────────────────── */
const MeetingCard: React.FC<{ metadata: MeetingMetadata }> = ({ metadata }) => {
  const meetDate = new Date(metadata.date);
  return (
    <div className="meeting-card">
      <div className="meeting-card-header">
        <Video size={16} />
        <span>Réunion planifiée</span>
      </div>
      <h4 className="meeting-card-title">{metadata.titre}</h4>
      <div className="meeting-card-detail">
        <Clock size={13} />
        <span>{meetDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>
      <div className="meeting-card-detail">
        <Clock size={13} />
        <span>{meetDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      {metadata.description && (
        <p className="meeting-card-desc">{metadata.description}</p>
      )}
      <a
        href={metadata.lien}
        target="_blank"
        rel="noopener noreferrer"
        className="meeting-join-btn"
      >
        <ExternalLink size={14} />
        Rejoindre la réunion
      </a>
    </div>
  );
};

/* ─── Main Messages Page ──────────────────────────────────────────── */
/* ─── Participants List Modal ────────────────────────────────────────── */
interface ParticipantsListProps {
  onClose: () => void;
  participants: ConversationParticipant[];
  groupName: string;
}

const ParticipantsList: React.FC<ParticipantsListProps> = ({ onClose, participants, groupName }) => {
  const getInitials = (nom: string | null, prenom: string | null) => {
    return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase() || '?';
  };

  return (
    <div className="meeting-modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="meeting-modal participants-modal"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
      >
        <div className="meeting-modal-header">
          <div className="meeting-modal-title">
            <Users size={20} />
            <h3>Participants - {groupName}</h3>
          </div>
          <button className="meeting-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="participants-list-container">
          {participants.map((p) => (
            <div key={p.id_participant} className="participant-item-row">
              <div className="participant-avatar-small">
                {getInitials(p.utilisateur.nom, p.utilisateur.prenom)}
              </div>
              <div className="participant-info-small">
                <p className="p-name">{p.utilisateur.prenom} {p.utilisateur.nom}</p>
                <p className="p-email">{p.utilisateur.email}</p>
              </div>
              {p.isAdmin && <span className="admin-tag-small">Admin</span>}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

const Messages: React.FC = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const userRole = typeof user?.role === 'string' ? user.role : (user?.role as any)?.nom;
  const isSuperAdmin = userRole === 'SuperAdmin';

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (activeConv) fetchMessages(activeConv.id_conversation);
  }, [activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const data = await messagingService.getConversations();
      setConversations(data);
      if (data.length > 0) setActiveConv(data[0]);
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (convId: number) => {
    setMsgLoading(true);
    try {
      const data = await messagingService.getMessages(convId);
      setMessages(data);
    } catch (err) {
      console.error('Failed to load messages', err);
    } finally {
      setMsgLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !activeConv || sending) return;
    setSending(true);
    try {
      const msg = await messagingService.sendTextMessage(activeConv.id_conversation, inputValue.trim());
      setMessages(prev => [...prev, msg]);
      setInputValue('');
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setSending(false);
    }
  };

  const handleSendMeeting = async (meta: MeetingMetadata) => {
    if (!activeConv) return;
    setShowMeetingForm(false);
    setSending(true);
    try {
      const msg = await messagingService.sendMeetingMessage(activeConv.id_conversation, meta);
      setMessages(prev => [...prev, msg]);
      setNotification({ type: 'success', text: 'Réunion planifiée et envoyée avec succès !' });
    } catch (err: any) {
      console.error('Failed to send meeting', err);
      const errorMsg = err.response?.data?.message || 'Erreur lors de la création de la réunion. Vérifiez les champs obligatoires.';
      setNotification({ type: 'error', text: errorMsg });
    } finally {
      setSending(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const getInitials = (nom: string | null, prenom: string | null) => {
    return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase() || '?';
  };

  const getParticipantCount = (conv: Conversation) => conv.participants.length;

  const getLastMessage = (conv: Conversation) => {
    if (!conv.messages || conv.messages.length === 0) return 'Aucun message';
    const last = conv.messages[0];
    if (last.type === 'meeting') return '📅 Réunion planifiée';
    return last.contenu.length > 40 ? last.contenu.slice(0, 40) + '…' : last.contenu;
  };

  const getSenderName = (msg: ChatMessage) => {
    const { nom, prenom } = msg.expediteur;
    return `${prenom ?? ''} ${nom ?? ''}`.trim() || 'Inconnu';
  };

  const isOwnMessage = (msg: ChatMessage) => msg.id_expediteur === (user as any)?.id;

  if (loading) {
    return (
      <div className="messages-page">
        <div className="messages-loading">
          <Loader2 className="animate-spin" size={36} />
          <p>Chargement de la messagerie...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-page">
      <BackButton />
      <header className="page-header">
        <div>
          <h1>Messagerie</h1>
          <p className="subtitle">Espace de discussion dédié aux Admins et au SuperAdmin.</p>
        </div>
      </header>

      <div className="messages-layout premium-card">
        {/* ── Sidebar ── */}
        <aside className="conv-sidebar">
          <div className="conv-sidebar-header">
            <MessageSquare size={16} />
            <span>Conversations</span>
          </div>
          <div className="conv-list">
            {conversations.length === 0 ? (
              <div className="conv-empty">
                <p>Aucune conversation disponible.</p>
              </div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.id_conversation}
                  className={`conv-item ${activeConv?.id_conversation === conv.id_conversation ? 'active' : ''}`}
                  onClick={() => setActiveConv(conv)}
                >
                  <div className="conv-avatar">
                    {conv.is_system ? <Users size={18} /> : <MessageSquare size={18} />}
                  </div>
                  <div className="conv-info">
                    <div className="conv-name">
                      {conv.nom || 'Conversation'}
                      {conv.is_system && <span className="system-badge">Système</span>}
                    </div>
                    <div className="conv-last-msg">{getLastMessage(conv)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ── Chat Area ── */}
        <main className="chat-area">
          {!activeConv ? (
            <div className="chat-placeholder">
              <MessageSquare size={48} />
              <h3>Sélectionnez une conversation</h3>
              <p>Choisissez un groupe dans la liste à gauche pour commencer.</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="chat-header">
                <div className="chat-header-info">
                  <div className="chat-avatar">
                    {activeConv.is_system ? <Users size={20} /> : <MessageSquare size={20} />}
                  </div>
                  <div>
                    <h3>{activeConv.nom}</h3>
                    <span 
                      className="chat-members clickable" 
                      onClick={() => setShowParticipants(true)}
                      title="Voir les participants"
                    >
                      <Users size={12} />
                      {getParticipantCount(activeConv)} participants
                    </span>
                  </div>
                </div>
                {/* Bouton Créer Réunion — SuperAdmin uniquement */}
                {isSuperAdmin && activeConv.is_system && (
                  <button
                    className="btn-create-meeting"
                    onClick={() => setShowMeetingForm(true)}
                  >
                    <Calendar size={16} />
                    Créer réunion
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="chat-messages-area">
                {msgLoading ? (
                  <div className="msg-loading">
                    <Loader2 className="animate-spin" size={28} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="msg-empty">
                    <MessageSquare size={40} />
                    <p>Aucun message pour l'instant. Soyez le premier à écrire !</p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {messages.map(msg => {
                      const own = isOwnMessage(msg);
                      const meetMeta: MeetingMetadata | null =
                        msg.type === 'meeting' && msg.metadata
                          ? JSON.parse(msg.metadata)
                          : null;

                      return (
                        <motion.div
                          key={msg.id_message}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`msg-wrapper ${own ? 'own' : 'other'}`}
                        >
                          {!own && (
                            <div className="msg-sender-avatar">
                              {getInitials(msg.expediteur.nom, msg.expediteur.prenom)}
                            </div>
                          )}
                          <div className="msg-bubble-group">
                            {!own && (
                              <span className="msg-sender-name">{getSenderName(msg)}</span>
                            )}
                            {meetMeta ? (
                              <MeetingCard metadata={meetMeta} />
                            ) : (
                              <div className="msg-bubble">
                                <p>{msg.contenu}</p>
                              </div>
                            )}
                            <span className="msg-time">
                              {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="chat-input-bar">
                <input
                  type="text"
                  placeholder="Écrire un message..."
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  disabled={sending}
                />
                <button type="submit" className="btn-send" disabled={!inputValue.trim() || sending}>
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </form>
            </>
          )}
        </main>
      </div>

      {/* Meeting Form Modal */}
      <AnimatePresence>
        {showMeetingForm && (
          <MeetingForm
            onClose={() => setShowMeetingForm(false)}
            onSend={handleSendMeeting}
          />
        )}
      </AnimatePresence>

      {/* Participants List Modal */}
      <AnimatePresence>
        {showParticipants && activeConv && (
          <ParticipantsList
            onClose={() => setShowParticipants(false)}
            participants={activeConv.participants}
            groupName={activeConv.nom || ''}
          />
        )}
      </AnimatePresence>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`toast-notification ${notification.type}`}
          >
            {notification.text}
            <button onClick={() => setNotification(null)} className="close-toast"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Messages;
