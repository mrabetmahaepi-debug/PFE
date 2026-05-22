import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Send, Video, Users,
  ExternalLink, X, Loader2, Clock, Link2, Plus, Trash2, Pencil, Paperclip, FileText, Mic, Square,
  MoreVertical, Smile,
} from 'lucide-react';
import { messagingService, type Conversation, type ChatMessage, type MeetingMetadata, type ConversationParticipant } from '../services/messaging.service';
import { useAuth } from '../hooks/useAuth';
import { isSuperAdmin as detectSuperAdmin } from '../lib/permissions';
import { resolveMessageAttachmentUrl, formatFileSize } from '../lib/messagingAttachments';
import { useSearchParams } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { CreateDiscussionModal, ManageMembersModal, EditDiscussionModal } from '../components/MessagingAdminModals';
import '../components/MessagingAdminModals.css';
import './Messages.css';

/* ─── Meeting Form Modal (light / ClickUp-style) ───────────────────── */
interface MeetingFormProps {
  onClose: () => void;
  onSend: (meta: MeetingMetadata) => void | Promise<void>;
  submitting?: boolean;
}

const MeetingForm: React.FC<MeetingFormProps> = ({ onClose, onSend, submitting }) => {
  const [titre, setTitre] = useState('');
  const [date, setDate] = useState('');
  const [lien, setLien] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = titre.trim();
    const l = lien.trim();
    if (!t || !date || !l || submitting) return;
    await Promise.resolve(
      onSend({
        titre: t,
        date,
        lien: l,
        description: description.trim() || undefined,
      })
    );
  };

  return (
    <motion.div
      className="messaging-light-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !submitting && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        className="messaging-light-modal messaging-light-modal--wide"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="messaging-light-modal-header">
          <div className="messaging-light-modal-title-block">
            <div className="messaging-light-modal-icon" aria-hidden>
              <Video size={20} />
            </div>
            <div>
              <h3>Créer une réunion</h3>
            </div>
          </div>
          <button
            type="button"
            className="messaging-light-close"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="messaging-light-form">
          <div className="messaging-light-field">
            <label htmlFor="meeting-title">Titre de la réunion</label>
            <input
              id="meeting-title"
              type="text"
              placeholder="ex: Réunion mensuelle des admins"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              required
              disabled={submitting}
              autoFocus
              maxLength={200}
            />
          </div>
          <div className="messaging-light-field">
            <label htmlFor="meeting-date">
              <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} aria-hidden />
              Date & heure
            </label>
            <input
              id="meeting-date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div className="messaging-light-field">
            <label htmlFor="meeting-link">
              <Link2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} aria-hidden />
              Lien Google Meet / Zoom
            </label>
            <input
              id="meeting-link"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="https://meet.google.com/..."
              value={lien}
              onChange={(e) => setLien(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div className="messaging-light-field">
            <label htmlFor="meeting-desc">Description (optionnelle)</label>
            <textarea
              id="meeting-desc"
              placeholder="Ordre du jour, notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={submitting}
            />
          </div>
          <div className="messaging-light-footer">
            <button
              type="button"
              className="messaging-light-btn-secondary"
              disabled={submitting}
              onClick={() => !submitting && onClose()}
            >
              Annuler
            </button>
            <button type="submit" className="messaging-light-btn-primary" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Video size={16} />}
              Envoyer la réunion
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

/* ─── Meeting Message Card ────────────────────────────────────────── */
const MeetingCard: React.FC<{ metadata: MeetingMetadata }> = ({ metadata }) => {
  const meetDate = new Date(metadata.date);
  return (
    <div className="meeting-card">
      <div className="meeting-card-header">
        <Video size={16} aria-hidden />
        <span className="meeting-card-header-label">RÉUNION PLANIFIÉE</span>
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

const ATTACHMENT_ACCEPT =
  '.jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,image/jpeg,image/png,image/webp,image/gif,application/pdf';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function pickVoiceRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}

function formatRecordDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function formatAxiosLikeError(err: unknown): string {
  const ax = err as {
    response?: { data?: { message?: string; error?: string } };
    message?: string;
  };
  const d = ax.response?.data;
  const fromBody =
    (typeof d?.message === 'string' && d.message.trim()) ||
    (typeof d?.error === 'string' && d.error.trim()) ||
    '';
  return fromBody || (typeof ax.message === 'string' ? ax.message : '') || '';
}

const QUICK_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '👏', '✅'] as const;

function messageTextIsEditable(msg: ChatMessage): boolean {
  if (msg.deleted) return false;
  if (msg.type === 'meeting' || msg.type === 'voice') return false;
  if (msg.type === 'text') return true;
  if (msg.type === 'image' || msg.type === 'file') {
    return !!String(msg.contenu ?? '').trim();
  }
  return false;
}

type MsgActionsState = { messageId: number; phase: 'menu' | 'react' } | null;

interface MessageHoverActionsProps {
  msg: ChatMessage;
  msgActions: MsgActionsState;
  setMsgActions: React.Dispatch<React.SetStateAction<MsgActionsState>>;
  canEdit: boolean;
  canDelete: boolean;
  canReact: boolean;
  onChooseEdit: () => void;
  onChooseDelete: () => void;
  onPickReaction: (emoji: string) => void;
}

const MessageHoverActions: React.FC<MessageHoverActionsProps> = ({
  msg,
  msgActions,
  setMsgActions,
  canEdit,
  canDelete,
  canReact,
  onChooseEdit,
  onChooseDelete,
  onPickReaction,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const open = msgActions?.messageId === msg.id_message;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setMsgActions(null);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, setMsgActions]);

  if (!canEdit && !canDelete && !canReact) return null;

  return (
    <div className="msg-actions-wrap" ref={wrapRef}>
      <button
        type="button"
        className="msg-actions-trigger"
        aria-label="Actions du message"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setMsgActions((cur) =>
            cur?.messageId === msg.id_message ? null : { messageId: msg.id_message, phase: 'menu' }
          );
        }}
      >
        <MoreVertical size={16} strokeWidth={2} />
      </button>
      {open && (
        <div className="msg-actions-dropdown" role="menu">
          {msgActions?.phase === 'menu' && (
            <>
              {canEdit && (
                <button
                  type="button"
                  role="menuitem"
                  className="msg-actions-item"
                  onClick={() => {
                    setMsgActions(null);
                    onChooseEdit();
                  }}
                >
                  <Pencil size={14} aria-hidden /> Modifier
                </button>
              )}
              {canReact && (
                <button
                  type="button"
                  role="menuitem"
                  className="msg-actions-item"
                  onClick={() =>
                    setMsgActions({ messageId: msg.id_message, phase: 'react' })
                  }
                >
                  <Smile size={14} aria-hidden /> Réagir
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  role="menuitem"
                  className="msg-actions-item msg-actions-item--danger"
                  onClick={() => {
                    setMsgActions(null);
                    onChooseDelete();
                  }}
                >
                  <Trash2 size={14} aria-hidden /> Supprimer
                </button>
              )}
            </>
          )}
          {msgActions?.phase === 'react' && (
            <div className="msg-actions-react-panel" role="group" aria-label="Réactions rapides">
              {QUICK_REACTION_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  className="msg-react-choice"
                  onClick={() => {
                    onPickReaction(em);
                    setMsgActions(null);
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function MessageReactionsRow({
  msg,
  onToggle,
}: {
  msg: ChatMessage;
  onToggle: (emoji: string) => void;
}) {
  const rows = msg.reactions ?? [];
  if (rows.length === 0) return null;
  return (
    <div className="msg-reactions-row">
      {rows.map((r) => (
        <button
          key={r.emoji}
          type="button"
          className={`msg-reaction-badge${r.reactedByMe ? ' msg-reaction-badge--mine' : ''}`}
          onClick={() => void onToggle(r.emoji)}
          title={r.reactedByMe ? 'Retirer votre réaction' : 'Ajouter cette réaction'}
        >
          <span className="msg-reaction-emoji">{r.emoji}</span>
          <span className="msg-reaction-count">{r.count}</span>
        </button>
      ))}
    </div>
  );
}

function MessageAttachmentBubble({ msg }: { msg: ChatMessage }) {
  const href = resolveMessageAttachmentUrl(msg.attachmentUrl);
  const isImg = msg.type === 'image';
  const caption = msg.contenu?.trim();

  return (
    <div className="msg-attachment-card">
      {isImg ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="msg-attachment-image-link"
        >
          <img
            src={href}
            alt={msg.attachmentName || 'Image'}
            className="msg-attachment-image"
            loading="lazy"
          />
        </a>
      ) : (
        <div className="msg-attachment-file">
          <FileText size={22} className="msg-attachment-file-icon" aria-hidden />
          <div className="msg-attachment-file-meta">
            <span className="msg-attachment-file-name">
              📎 {msg.attachmentName || 'Fichier'}
            </span>
            <span className="msg-attachment-file-size">{formatFileSize(msg.attachmentSize)}</span>
          </div>
          <div className="msg-attachment-file-actions">
            <a href={href} target="_blank" rel="noopener noreferrer" className="msg-attachment-link-btn">
              Ouvrir
            </a>
            <a
              href={href}
              download={msg.attachmentName || 'fichier'}
              className="msg-attachment-link-btn msg-attachment-link-btn--secondary"
            >
              Télécharger
            </a>
          </div>
        </div>
      )}
      {caption ? <p className="msg-attachment-caption">{caption}</p> : null}
    </div>
  );
}

function VoiceMessageBubble({ msg }: { msg: ChatMessage }) {
  const href = resolveMessageAttachmentUrl(msg.audioUrl ?? msg.attachmentUrl);
  const mimeType = msg.attachmentMime || msg.attachmentType || 'audio/webm';
  return (
    <div className="msg-voice-card">
      <div className="msg-voice-label">
        <Mic size={16} aria-hidden />
        <span>Message vocal</span>
      </div>
      <audio
        className="msg-voice-player"
        controls
        preload="metadata"
        src={href || undefined}
      >
        {href ? <source src={href} type={mimeType.split(';')[0].trim()} /> : null}
      </audio>
    </div>
  );
}

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
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [msgLoading, setMsgLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [createDiscussionOpen, setCreateDiscussionOpen] = useState(false);
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [manageParticipantsVariant, setManageParticipantsVariant] = useState<'members' | 'admins'>(
    'members'
  );
  const [notification, setNotification] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [deleteConfirmConv, setDeleteConfirmConv] = useState<Conversation | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [editDiscussionConv, setEditDiscussionConv] = useState<Conversation | null>(null);
  const [msgActions, setMsgActions] = useState<MsgActionsState>(null);
  const [deleteMsgTarget, setDeleteMsgTarget] = useState<ChatMessage | null>(null);
  const [deleteMsgSubmitting, setDeleteMsgSubmitting] = useState(false);
  const [editMsgTarget, setEditMsgTarget] = useState<ChatMessage | null>(null);
  const [editMsgDraft, setEditMsgDraft] = useState('');
  const [editMsgSubmitting, setEditMsgSubmitting] = useState(false);
  const [meetingSubmitting, setMeetingSubmitting] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    previewUrl?: string;
  } | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  type VoiceUiPhase = 'idle' | 'recording' | 'preview';
  const [voiceUi, setVoiceUi] = useState<VoiceUiPhase>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [recordMs, setRecordMs] = useState(0);
  const [voicePreviewBlob, setVoicePreviewBlob] = useState<Blob | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discardVoiceRef = useRef(false);
  const voiceAutoSendRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = detectSuperAdmin(user);
  const tenantRoleKey = String(
    typeof user?.role === 'string' ? user.role : (user as { role?: { nom?: string } })?.role?.nom ?? ''
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  const isTenantAdmin =
    tenantRoleKey === 'admin' || tenantRoleKey === 'administrateur';

  /** Création / édition / suppression de discussions d'entreprise (hors système) : admin tenant ou super admin. */
  const canManageEnterpriseDiscussions = isTenantAdmin || isSuperAdmin;

  const canScheduleMeeting =
    !!activeConv &&
    ((!activeConv.is_system && (isTenantAdmin || isSuperAdmin)) ||
      (activeConv.is_system && isSuperAdmin));

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (activeConv) fetchMessages(activeConv.id_conversation);
  }, [activeConv]);

  useEffect(() => {
    setShowMeetingForm(false);
    setMsgActions(null);
    setDeleteMsgTarget(null);
    setEditMsgTarget(null);
    setEditMsgDraft('');
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    discardVoiceRef.current = true;
    voiceAutoSendRef.current = false;
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && (mr.state === 'recording' || mr.state === 'paused')) {
      try {
        mr.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setVoicePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setVoicePreviewBlob(null);
    setVoiceUi('idle');
    setVoiceError(null);
    setRecordMs(0);
  }, [activeConv?.id_conversation]);

  useEffect(() => {
    return () => {
      discardVoiceRef.current = true;
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      const mr = mediaRecorderRef.current;
      if (mr && (mr.state === 'recording' || mr.state === 'paused')) {
        try {
          mr.stop();
        } catch {
          /* ignore */
        }
      }
      mediaRecorderRef.current = null;
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      setVoicePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const showMessagingError = useCallback((text: string) => {
    setNotification({ type: 'error', text });
    window.setTimeout(() => setNotification(null), 6000);
  }, []);

  const showMessagingSuccess = useCallback((text: string) => {
    setNotification({ type: 'success', text });
    window.setTimeout(() => setNotification(null), 4000);
  }, []);

  const userEntrepriseId = Number((user as { id_entreprise?: number | null })?.id_entreprise ?? NaN);

  const canModerateDeleteMessage = useCallback(
    (msg: ChatMessage) => {
      const myId = Number((user as { id?: number })?.id);
      if (!Number.isFinite(myId)) return false;
      if (msg.id_expediteur === myId) return true;
      if (!activeConv) return false;
      if (isSuperAdmin) return true;
      if (
        isTenantAdmin &&
        !activeConv.is_system &&
        activeConv.id_entreprise != null &&
        Number(activeConv.id_entreprise) === userEntrepriseId
      ) {
        return true;
      }
      return false;
    },
    [user, activeConv, isSuperAdmin, isTenantAdmin, userEntrepriseId]
  );

  const handleToggleMessageReaction = useCallback(
    async (messageId: number, emoji: string) => {
      if (!activeConv) return;
      try {
        const reactions = await messagingService.toggleMessageReaction(
          activeConv.id_conversation,
          messageId,
          emoji
        );
        setMessages((prev) =>
          prev.map((m) => (m.id_message === messageId ? { ...m, reactions } : m))
        );
      } catch (err: unknown) {
        showMessagingError(formatAxiosLikeError(err) || "Impossible d'enregistrer la réaction.");
      }
    },
    [activeConv, showMessagingError]
  );

  const handleConfirmDeleteMessage = useCallback(async () => {
    if (!deleteMsgTarget || !activeConv) return;
    setDeleteMsgSubmitting(true);
    try {
      const updated = await messagingService.deleteMessage(
        activeConv.id_conversation,
        deleteMsgTarget.id_message
      );
      setMessages((prev) =>
        prev.map((m) => (m.id_message === updated.id_message ? updated : m))
      );
      setDeleteMsgTarget(null);
      showMessagingSuccess('Message supprimé.');
    } catch (err: unknown) {
      showMessagingError(formatAxiosLikeError(err) || 'Impossible de supprimer le message.');
    } finally {
      setDeleteMsgSubmitting(false);
    }
  }, [deleteMsgTarget, activeConv, showMessagingSuccess, showMessagingError]);

  const handleSaveEditMessage = useCallback(async () => {
    if (!editMsgTarget || !activeConv) return;
    const text = editMsgDraft.trim();
    if (!text) return;
    setEditMsgSubmitting(true);
    try {
      const updated = await messagingService.updateMessage(
        activeConv.id_conversation,
        editMsgTarget.id_message,
        text
      );
      setMessages((prev) =>
        prev.map((m) => (m.id_message === updated.id_message ? updated : m))
      );
      setEditMsgTarget(null);
      setEditMsgDraft('');
      showMessagingSuccess('Message modifié.');
    } catch (err: unknown) {
      showMessagingError(formatAxiosLikeError(err) || 'Impossible de modifier le message.');
    } finally {
      setEditMsgSubmitting(false);
    }
  }, [editMsgTarget, activeConv, editMsgDraft, showMessagingSuccess, showMessagingError]);

  const fetchConversations = async () => {
    try {
      setListError(null);
      const data = await messagingService.getConversations();
      setConversations(data);
      const convParam = searchParams.get('conv');
      const convFromUrl =
        convParam && Number.isFinite(Number(convParam))
          ? data.find((c) => c.id_conversation === Number(convParam))
          : undefined;
      setActiveConv((prev) => {
        if (data.length === 0) return null;
        if (convFromUrl) return convFromUrl;
        if (prev) {
          const match = data.find((c) => c.id_conversation === prev.id_conversation);
          return match ?? data[0];
        }
        return data[0];
      });
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const backendMsg = ax.response?.data?.message;
      console.error('[Messages] Failed to load conversations', err);
      setListError(
        backendMsg ||
          ax.message ||
          'Impossible de charger les conversations.'
      );
      setConversations([]);
      setActiveConv(null);
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

  const handleDiscussionCreated = (conv: Conversation) => {
    setConversations((prev) => {
      const rest = prev.filter((c) => c.id_conversation !== conv.id_conversation);
      return [conv, ...rest];
    });
    setActiveConv(conv);
    setMessages([]);
    setNotification({ type: 'success', text: 'Discussion créée.' });
    window.setTimeout(() => setNotification(null), 4000);
  };

  const handleDiscussionUpdated = (conv: Conversation) => {
    const myId = Number((user as { id?: number })?.id);
    const imIn =
      Number.isFinite(myId) && conv.participants.some((p) => p.id_utilisateur === myId);
    if (!imIn) {
      void fetchConversations();
      return;
    }
    setConversations((prev) =>
      prev.map((c) => (c.id_conversation === conv.id_conversation ? conv : c))
    );
    setActiveConv((prev) =>
      prev?.id_conversation === conv.id_conversation ? conv : prev
    );
  };

  const handleConfirmDeleteDiscussion = async () => {
    if (!deleteConfirmConv) return;
    setDeleteSubmitting(true);
    try {
      await messagingService.deleteDiscussion(deleteConfirmConv.id_conversation);
      const removedId = deleteConfirmConv.id_conversation;
      setDeleteConfirmConv(null);
      const nextList = conversations.filter((c) => c.id_conversation !== removedId);
      setConversations(nextList);
      setActiveConv((prev) => {
        if (!prev || prev.id_conversation !== removedId) return prev;
        return nextList[0] ?? null;
      });
      setNotification({ type: 'success', text: 'Discussion supprimée avec succès.' });
      window.setTimeout(() => setNotification(null), 4000);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      const backendMsg = ax.response?.data?.message;
      showMessagingError(
        backendMsg || ax.message || 'Impossible de supprimer la discussion.'
      );
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || sending) return;
    const text = inputValue.trim();
    if (!text && !pendingAttachment) return;

    setSending(true);
    try {
      if (pendingAttachment) {
        const form = new FormData();
        form.append('file', pendingAttachment.file);
        if (text) form.append('content', text);
        const msg = await messagingService.sendMessageWithAttachment(
          activeConv.id_conversation,
          form
        );
        setMessages((prev) => [...prev, msg]);
        if (pendingAttachment.previewUrl) {
          URL.revokeObjectURL(pendingAttachment.previewUrl);
        }
        setPendingAttachment(null);
        setInputValue('');
      } else {
        const msg = await messagingService.sendTextMessage(activeConv.id_conversation, text);
        setMessages((prev) => [...prev, msg]);
        setInputValue('');
      }
    } catch (err: unknown) {
      console.error('Failed to send message', err);
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      showMessagingError(
        ax.response?.data?.message ||
          ax.message ||
          "Impossible d'envoyer le message."
      );
    } finally {
      setSending(false);
    }
  };

  const handleSendMeeting = async (meta: MeetingMetadata) => {
    if (!activeConv) return;
    setMeetingSubmitting(true);
    try {
      const msg = await messagingService.createDiscussionMeeting(activeConv.id_conversation, {
        title: meta.titre,
        meetingDate: meta.date,
        meetingLink: meta.lien,
        description: meta.description,
      });
      setMessages((prev) => [...prev, msg]);
      setShowMeetingForm(false);
      setNotification({ type: 'success', text: 'Réunion envoyée avec succès.' });
      window.setTimeout(() => setNotification(null), 4000);
    } catch (err: unknown) {
      console.error('Failed to send meeting', err);
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      const backendMsg = ax.response?.data?.message;
      showMessagingError(
        backendMsg ||
          ax.message ||
          'Erreur lors de la création de la réunion. Vérifiez les champs obligatoires.'
      );
    } finally {
      setMeetingSubmitting(false);
    }
  };

  const getInitials = (nom: string | null, prenom: string | null) => {
    return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase() || '?';
  };

  const getParticipantCount = (conv: Conversation) => conv.participants.length;

  const getLastMessage = (conv: Conversation) => {
    if (!conv.messages || conv.messages.length === 0) return 'Aucun message';
    const last = conv.messages[0];
    if (last.deleted || last.deletedAt) return 'Message supprimé';
    if (last.type === 'meeting') return '📅 Réunion planifiée';
    if (last.type === 'voice') return '🎤 Message vocal';
    if (last.type === 'image' || last.type === 'file') {
      return last.attachmentName ? `📎 ${last.attachmentName}` : '📎 Fichier';
    }
    const c = String(last.contenu ?? '');
    if (!c) return 'Message';
    return c.length > 40 ? c.slice(0, 40) + '…' : c;
  };

  const getSenderName = (msg: ChatMessage) => {
    const { nom, prenom } = msg.expediteur;
    return `${prenom ?? ''} ${nom ?? ''}`.trim() || 'Inconnu';
  };

  const isOwnMessage = (msg: ChatMessage) => msg.id_expediteur === (user as any)?.id;

  const clearPendingAttachment = useCallback(() => {
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  }, []);

  const handleAttachmentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      showMessagingError('Le fichier ne doit pas dépasser 10 Mo.');
      return;
    }
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      const previewUrl = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined;
      return { file, previewUrl };
    });
  };

  const uploadVoiceBlob = async (blob: Blob) => {
    if (!activeConv || sending) return;
    if (!blob.size) {
      showMessagingError('Message vocal vide.');
      return;
    }
    setSending(true);
    try {
      const msg = await messagingService.sendVoiceMessage(activeConv.id_conversation, blob);
      setMessages((prev) => [...prev, msg]);
      setVoicePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setVoicePreviewBlob(null);
      setVoiceUi('idle');
      setVoiceError(null);
      setRecordMs(0);
    } catch (err: unknown) {
      console.error('Voice send failed', err);
      const detail = formatAxiosLikeError(err);
      showMessagingError(detail || "Impossible d'envoyer le message vocal.");
    } finally {
      setSending(false);
    }
  };

  const startVoiceRecording = async () => {
    if (!activeConv || sending || meetingSubmitting) return;
    setVoiceError(null);
    if (typeof window.MediaRecorder === 'undefined') {
      setVoiceError("L'enregistrement vocal n'est pas supporté par ce navigateur.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("L'enregistrement vocal n'est pas supporté par ce navigateur.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setVoiceError('Autorisation microphone refusée.');
      return;
    }
    discardVoiceRef.current = false;
    voiceAutoSendRef.current = false;
    mediaStreamRef.current = stream;
    voiceChunksRef.current = [];
    const preferred = pickVoiceRecorderMime();
    let mr: MediaRecorder;
    try {
      mr = preferred
        ? new MediaRecorder(stream, { mimeType: preferred })
        : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      setVoiceError("L'enregistrement vocal n'est pas supporté par ce navigateur.");
      return;
    }
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (ev) => {
      if (ev.data.size > 0) voiceChunksRef.current.push(ev.data);
    };
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      const mime = mr.mimeType || 'audio/webm';
      const blob = new Blob(voiceChunksRef.current, { type: mime });
      voiceChunksRef.current = [];
      mediaRecorderRef.current = null;
      if (discardVoiceRef.current) {
        discardVoiceRef.current = false;
        setVoiceUi('idle');
        setRecordMs(0);
        return;
      }
      if (blob.size === 0) {
        setVoiceUi('idle');
        setRecordMs(0);
        setVoiceError('Message vocal vide.');
        return;
      }
      if (voiceAutoSendRef.current) {
        voiceAutoSendRef.current = false;
        setVoiceUi('idle');
        setRecordMs(0);
        void uploadVoiceBlob(blob);
        return;
      }
      setVoicePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      setVoicePreviewBlob(blob);
      setVoiceUi('preview');
      setRecordMs(0);
    };
    recordStartRef.current = Date.now();
    setRecordMs(0);
    recordTimerRef.current = setInterval(() => {
      setRecordMs(Date.now() - recordStartRef.current);
    }, 200);
    try {
      mr.start(200);
    } catch {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      stream.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      setVoiceError("L'enregistrement vocal n'est pas supporté par ce navigateur.");
      return;
    }
    setVoiceUi('recording');
  };

  const stopVoiceRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === 'recording') {
      discardVoiceRef.current = false;
      mr.stop();
    }
  };

  const cancelVoiceRecording = () => {
    voiceAutoSendRef.current = false;
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && (mr.state === 'recording' || mr.state === 'paused')) {
      discardVoiceRef.current = true;
      mr.stop();
    } else {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      setVoiceUi('idle');
      setRecordMs(0);
    }
  };

  const cancelVoicePreview = () => {
    setVoicePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setVoicePreviewBlob(null);
    setVoiceUi('idle');
    setVoiceError(null);
    setRecordMs(0);
  };

  const handleSendVoiceMessage = async () => {
    if (!voicePreviewBlob) return;
    await uploadVoiceBlob(voicePreviewBlob);
  };

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
        </div>
      </header>

      {listError && (
        <div className="messages-banner-error" role="alert">
          {listError}
        </div>
      )}

      <div className="messages-layout premium-card messages-layout--saas">
        {/* ── Sidebar ── */}
        <aside className="conv-sidebar">
          <div className="conv-sidebar-header conv-sidebar-header--row">
            <div className="conv-sidebar-title">
              <MessageSquare size={16} />
              <span>Conversations</span>
            </div>
            {canManageEnterpriseDiscussions && (
              <button
                type="button"
                className="btn-new-discussion"
                onClick={() => setCreateDiscussionOpen(true)}
              >
                <Plus size={15} />
                Nouvelle discussion
              </button>
            )}
          </div>
          <div className="conv-list">
            {conversations.length === 0 ? (
              <div className="conv-empty conv-empty--prominent">
                <MessageSquare size={36} strokeWidth={1.25} className="conv-empty-icon" aria-hidden />
                <p className="conv-empty-title">Aucune discussion pour le moment.</p>
                {canManageEnterpriseDiscussions && (
                  <button
                    type="button"
                    className="conv-empty-cta"
                    onClick={() => setCreateDiscussionOpen(true)}
                  >
                    <Plus size={16} />
                    Créer une discussion
                  </button>
                )}
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id_conversation}
                  className={`conv-item-row ${activeConv?.id_conversation === conv.id_conversation ? 'conv-item-row--active' : ''}`}
                >
                  <button
                    type="button"
                    className="conv-item"
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
                      <div className="conv-participant-hint">
                        {getParticipantCount(conv)} participant{getParticipantCount(conv) > 1 ? 's' : ''}
                      </div>
                    </div>
                  </button>
                  {canManageEnterpriseDiscussions && !conv.is_system && (
                    <div className="conv-item-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="conv-item-edit"
                        title="Modifier la discussion"
                        aria-label="Modifier la discussion"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditDiscussionConv(conv);
                        }}
                      >
                        <Pencil size={16} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="conv-item-delete"
                        title="Supprimer la discussion"
                        aria-label="Supprimer la discussion"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteConfirmConv(conv);
                        }}
                      >
                        <Trash2 size={16} strokeWidth={2} />
                      </button>
                    </div>
                  )}
                </div>
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
                <div className="chat-header-actions">
                  {canManageEnterpriseDiscussions && !activeConv.is_system && isSuperAdmin && (
                    <button
                      type="button"
                      className="btn-manage-members"
                      onClick={() => {
                        setManageParticipantsVariant('admins');
                        setManageMembersOpen(true);
                      }}
                    >
                      <Users size={16} />
                      Gérer les admins
                    </button>
                  )}
                  {canManageEnterpriseDiscussions &&
                    !activeConv.is_system &&
                    isTenantAdmin &&
                    !isSuperAdmin && (
                      <button
                        type="button"
                        className="btn-manage-members btn-manage-members--prominent"
                        onClick={() => {
                          setManageParticipantsVariant('members');
                          setManageMembersOpen(true);
                        }}
                      >
                        <Users size={16} />
                        Gérer les membres
                      </button>
                    )}
                  {canScheduleMeeting && (
                    <button
                      type="button"
                      className="btn-create-meeting"
                      onClick={() => setShowMeetingForm(true)}
                    >
                      <Video size={16} />
                      Créer une réunion
                    </button>
                  )}
                </div>
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
                    {messages.map((msg) => {
                      const own = isOwnMessage(msg);
                      let meetMeta: MeetingMetadata | null = null;
                      if (!msg.deleted && msg.type === 'meeting' && msg.metadata) {
                        try {
                          meetMeta = JSON.parse(msg.metadata) as MeetingMetadata;
                        } catch {
                          meetMeta = null;
                        }
                      }

                      const canEdit = own && messageTextIsEditable(msg);
                      const canDelete = canModerateDeleteMessage(msg) && !msg.deleted;
                      const canReact = !msg.deleted;
                      const showActionsWrap = canEdit || canDelete || canReact;
                      const showTopBar = !own || showActionsWrap;

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
                          <div
                            className={`msg-bubble-group${own ? ' msg-bubble-group--own' : ''}`}
                          >
                            {showTopBar && (
                              <div className="msg-bubble-group-top">
                                {!own && (
                                  <span className="msg-sender-name">{getSenderName(msg)}</span>
                                )}
                                {showActionsWrap && (
                                  <MessageHoverActions
                                    msg={msg}
                                    msgActions={msgActions}
                                    setMsgActions={setMsgActions}
                                    canEdit={canEdit}
                                    canDelete={canDelete}
                                    canReact={canReact}
                                    onChooseEdit={() => {
                                      setEditMsgTarget(msg);
                                      setEditMsgDraft(msg.contenu || '');
                                    }}
                                    onChooseDelete={() => setDeleteMsgTarget(msg)}
                                    onPickReaction={(emoji) =>
                                      void handleToggleMessageReaction(msg.id_message, emoji)
                                    }
                                  />
                                )}
                              </div>
                            )}
                            {msg.deleted ? (
                              <div className="msg-bubble msg-bubble--deleted">
                                <p>Message supprimé</p>
                              </div>
                            ) : meetMeta ? (
                              <MeetingCard metadata={meetMeta} />
                            ) : msg.type === 'voice' && (msg.attachmentUrl || msg.audioUrl) ? (
                              <VoiceMessageBubble msg={msg} />
                            ) : (msg.type === 'image' || msg.type === 'file') && msg.attachmentUrl ? (
                              <MessageAttachmentBubble msg={msg} />
                            ) : (
                              <div className="msg-bubble">
                                <p>{msg.contenu || '\u00a0'}</p>
                              </div>
                            )}
                            {!msg.deleted && (
                              <MessageReactionsRow
                                msg={msg}
                                onToggle={(emoji) =>
                                  void handleToggleMessageReaction(msg.id_message, emoji)
                                }
                              />
                            )}
                            <span className="msg-time">
                              {new Date(msg.createdAt).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {msg.editedAt && !msg.deleted && (
                                <span className="msg-edited-flag"> · modifié</span>
                              )}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Pending attachment preview */}
              {pendingAttachment && (
                <div className="msg-pending-attachment">
                  <div className="msg-pending-attachment-inner">
                    {pendingAttachment.previewUrl ? (
                      <img
                        src={pendingAttachment.previewUrl}
                        alt=""
                        className="msg-pending-thumb"
                      />
                    ) : (
                      <div className="msg-pending-doc">
                        <FileText size={24} aria-hidden />
                      </div>
                    )}
                    <div className="msg-pending-meta">
                      <span className="msg-pending-name">{pendingAttachment.file.name}</span>
                      <span className="msg-pending-size">
                        {formatFileSize(pendingAttachment.file.size)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="msg-pending-remove"
                      onClick={clearPendingAttachment}
                      aria-label="Retirer la pièce jointe"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              )}

              {voiceError && (
                <div className="voice-compose-error" role="alert">
                  {voiceError}
                </div>
              )}

              {(voiceUi === 'recording' || voiceUi === 'preview') && (
                <div className="voice-compose-panel">
                  {voiceUi === 'recording' && (
                    <div className="voice-compose-recording">
                      <span className="voice-rec-dot" aria-hidden />
                      <span className="voice-rec-label">Enregistrement</span>
                      <span className="voice-rec-time">{formatRecordDuration(recordMs)}</span>
                      <div className="voice-compose-actions">
                        <button
                          type="button"
                          className="voice-btn voice-btn--stop"
                          onClick={stopVoiceRecording}
                        >
                          <Square size={16} aria-hidden />
                          Arrêter
                        </button>
                        <button
                          type="button"
                          className="voice-btn voice-btn--ghost"
                          onClick={cancelVoiceRecording}
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          className="voice-btn voice-btn--send"
                          onClick={() => {
                            voiceAutoSendRef.current = true;
                            stopVoiceRecording();
                          }}
                        >
                          <Send size={16} aria-hidden />
                          Envoyer
                        </button>
                      </div>
                    </div>
                  )}
                  {voiceUi === 'preview' && voicePreviewUrl && (
                    <div className="voice-compose-preview">
                      <audio className="voice-preview-player" controls src={voicePreviewUrl} />
                      <div className="voice-compose-actions">
                        <button
                          type="button"
                          className="voice-btn voice-btn--send"
                          onClick={() => void handleSendVoiceMessage()}
                          disabled={sending}
                        >
                          {sending ? (
                            <Loader2 className="animate-spin" size={16} aria-hidden />
                          ) : (
                            <Send size={16} aria-hidden />
                          )}
                          Envoyer
                        </button>
                        <button
                          type="button"
                          className="voice-btn voice-btn--ghost"
                          onClick={cancelVoicePreview}
                          disabled={sending}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Input */}
              <input
                ref={attachmentInputRef}
                type="file"
                hidden
                accept={ATTACHMENT_ACCEPT}
                onChange={handleAttachmentInputChange}
              />
              <form onSubmit={handleSend} className="chat-input-bar">
                <button
                  type="button"
                  className="btn-chat-attach"
                  title="Joindre un fichier"
                  aria-label="Joindre un fichier"
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={sending || meetingSubmitting || voiceUi !== 'idle'}
                >
                  <Paperclip size={20} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="btn-chat-attach"
                  title="Message vocal"
                  aria-label="Message vocal"
                  onClick={() => void startVoiceRecording()}
                  disabled={
                    sending ||
                    meetingSubmitting ||
                    voiceUi !== 'idle' ||
                    !!pendingAttachment
                  }
                >
                  <Mic size={20} strokeWidth={2} />
                </button>
                <input
                  type="text"
                  placeholder="Écrire un message..."
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  disabled={sending || voiceUi === 'recording'}
                />
                <button
                  type="submit"
                  className="btn-send"
                  disabled={(!inputValue.trim() && !pendingAttachment) || sending}
                >
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </form>
            </>
          )}
        </main>
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {showMeetingForm && activeConv && canScheduleMeeting && (
              <MeetingForm
                key={activeConv.id_conversation}
                onClose={() => !meetingSubmitting && setShowMeetingForm(false)}
                onSend={handleSendMeeting}
                submitting={meetingSubmitting}
              />
            )}
          </AnimatePresence>,
          document.body
        )}

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {showParticipants && activeConv && (
              <ParticipantsList
                onClose={() => setShowParticipants(false)}
                participants={activeConv.participants}
                groupName={activeConv.nom || ''}
              />
            )}
          </AnimatePresence>,
          document.body
        )}

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {createDiscussionOpen && (
              <CreateDiscussionModal
                open={createDiscussionOpen}
                onClose={() => setCreateDiscussionOpen(false)}
                onCreated={handleDiscussionCreated}
                onError={showMessagingError}
                variant={isSuperAdmin ? 'super' : 'tenant'}
              />
            )}
          </AnimatePresence>,
          document.body
        )}

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {manageMembersOpen && activeConv && (
              <ManageMembersModal
                open={manageMembersOpen}
                variant={manageParticipantsVariant}
                conversation={activeConv}
                onClose={() => setManageMembersOpen(false)}
                onUpdated={handleDiscussionUpdated}
                onError={showMessagingError}
                onMemberRemoved={() => {
                  setNotification({ type: 'success', text: 'Membre retiré de la discussion.' });
                  window.setTimeout(() => setNotification(null), 4000);
                }}
              />
            )}
            {editDiscussionConv && (
              <EditDiscussionModal
                open
                conversation={editDiscussionConv}
                onClose={() => setEditDiscussionConv(null)}
                onSaved={(conv) => {
                  handleDiscussionUpdated(conv);
                  setNotification({ type: 'success', text: 'Discussion modifiée avec succès.' });
                  window.setTimeout(() => setNotification(null), 4000);
                }}
                onError={showMessagingError}
              />
            )}
          </AnimatePresence>,
          document.body
        )}

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {deleteConfirmConv && (
              <motion.div
                key="delete-discussion"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="messaging-light-overlay"
                onClick={() => !deleteSubmitting && setDeleteConfirmConv(null)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 10 }}
                  className="messaging-light-modal messaging-light-modal--confirm-delete"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="messaging-light-modal-header">
                    <div className="messaging-light-modal-title-block">
                      <div className="messaging-light-modal-icon messaging-light-modal-icon--warn" aria-hidden>
                        <Trash2 size={20} />
                      </div>
                      <div>
                        <h3>Supprimer la discussion ?</h3>
                        <p className="messaging-light-modal-subtitle">
                          Cette action supprimera la discussion et tous ses messages. Cette action est irréversible.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="messaging-light-close"
                      disabled={deleteSubmitting}
                      onClick={() => setDeleteConfirmConv(null)}
                      aria-label="Fermer"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="messaging-light-form messaging-light-form--footer-only">
                    <p className="messaging-light-delete-hint">
                      <strong>{deleteConfirmConv.nom || 'Discussion'}</strong>
                    </p>
                    <div className="messaging-light-footer">
                      <button
                        type="button"
                        className="messaging-light-btn-secondary"
                        disabled={deleteSubmitting}
                        onClick={() => setDeleteConfirmConv(null)}
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        className="messaging-light-btn-danger messaging-light-btn-danger--solid"
                        disabled={deleteSubmitting}
                        onClick={() => void handleConfirmDeleteDiscussion()}
                      >
                        {deleteSubmitting ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : null}
                        Supprimer
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {deleteMsgTarget && (
              <motion.div
                key="delete-message"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="messaging-light-overlay"
                onClick={() => !deleteMsgSubmitting && setDeleteMsgTarget(null)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 10 }}
                  className="messaging-light-modal messaging-light-modal--confirm-delete"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="messaging-light-modal-header">
                    <div className="messaging-light-modal-title-block">
                      <div
                        className="messaging-light-modal-icon messaging-light-modal-icon--warn"
                        aria-hidden
                      >
                        <Trash2 size={20} />
                      </div>
                      <div>
                        <h3>Supprimer ce message ?</h3>
                        <p className="messaging-light-modal-subtitle">
                          Le message sera retiré de la discussion pour tous les participants.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="messaging-light-close"
                      disabled={deleteMsgSubmitting}
                      onClick={() => setDeleteMsgTarget(null)}
                      aria-label="Fermer"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="messaging-light-form messaging-light-form--footer-only">
                    <div className="messaging-light-footer">
                      <button
                        type="button"
                        className="messaging-light-btn-secondary"
                        disabled={deleteMsgSubmitting}
                        onClick={() => setDeleteMsgTarget(null)}
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        className="messaging-light-btn-danger messaging-light-btn-danger--solid"
                        disabled={deleteMsgSubmitting}
                        onClick={() => void handleConfirmDeleteMessage()}
                      >
                        {deleteMsgSubmitting ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : null}
                        Supprimer
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {editMsgTarget && (
              <motion.div
                key="edit-message"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="messaging-light-overlay"
                onClick={() => {
                  if (!editMsgSubmitting) {
                    setEditMsgTarget(null);
                    setEditMsgDraft('');
                  }
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 10 }}
                  className="messaging-light-modal messaging-light-modal--wide"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="messaging-light-modal-header">
                    <div className="messaging-light-modal-title-block">
                      <div className="messaging-light-modal-icon" aria-hidden>
                        <Pencil size={20} />
                      </div>
                      <div>
                        <h3>Modifier le message</h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="messaging-light-close"
                      disabled={editMsgSubmitting}
                      onClick={() => !editMsgSubmitting && setEditMsgTarget(null)}
                      aria-label="Fermer"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="messaging-light-form">
                    <div className="messaging-light-field">
                      <label htmlFor="edit-msg-body">Message</label>
                      <textarea
                        id="edit-msg-body"
                        rows={4}
                        value={editMsgDraft}
                        onChange={(e) => setEditMsgDraft(e.target.value)}
                        disabled={editMsgSubmitting}
                        maxLength={8000}
                      />
                    </div>
                    <div className="messaging-light-footer">
                      <button
                        type="button"
                        className="messaging-light-btn-secondary"
                        disabled={editMsgSubmitting}
                        onClick={() => {
                          setEditMsgTarget(null);
                          setEditMsgDraft('');
                        }}
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        className="messaging-light-btn-primary"
                        disabled={editMsgSubmitting || !editMsgDraft.trim()}
                        onClick={() => void handleSaveEditMessage()}
                      >
                        {editMsgSubmitting ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : null}
                        Enregistrer
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

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
