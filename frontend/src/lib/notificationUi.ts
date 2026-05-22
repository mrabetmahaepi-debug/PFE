import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  UserPlus,
  Sparkles,
  Briefcase,
  ClipboardList,
  CheckCircle2,
  Flag,
  MailCheck,
  Shield,
  Clock,
  AlertTriangle,
  Bell,
} from 'lucide-react';
import type { AppNotification, NotificationUiKind } from '../types/notification';

export function parseNotificationMetadata(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function norm(s: string | null | undefined) {
  return (s || '').toLowerCase();
}

/** Map DB row → semantic kind for icon / routing hints */
export function classifyNotification(n: AppNotification): NotificationUiKind {
  const sujet = norm(n.sujet);
  const msg = norm(n.message);
  const t = norm(n.type);
  const meta = parseNotificationMetadata(n.metadata);

  if (sujet.includes('inscription') || sujet.includes('demande')) return 'invite';
  if (meta?.action === 'approve_user') return 'welcome';
  if (sujet.includes('compte activé') || msg.includes('approuvé')) return 'welcome';
  if (sujet.includes('invitation acceptée')) return 'invite_accepted';
  if (sujet.includes('invitation') || msg.includes('invit')) return 'invite';
  if (sujet.includes('nouvelle entreprise') || t === 'enterprise') return 'workspace';
  if (sujet.includes('sprint')) return 'sprint';
  if (sujet.includes('rôle') || sujet.includes('role')) return 'role';
  if (sujet.includes('assign')) return 'task_assigned';
  if (sujet.includes('termin') || msg.includes('terminée')) return 'task_done';
  if (sujet.includes('échéance') || sujet.includes('deadline')) return 'deadline';
  if (t === 'danger' || sujet.includes('retard') || sujet.includes('risque')) return 'risk';
  if (t === 'warning' && (sujet.includes('retard') || sujet.includes('alerte'))) return 'risk';
  if (t === 'project') return 'project';
  if (t === 'user') return 'invite';
  if (t === 'success' && (msg.includes('entreprise') || sujet.includes('entreprise'))) return 'workspace';
  return 'default';
}

const KIND_ICONS: Record<NotificationUiKind, LucideIcon> = {
  workspace: Building2,
  invite: UserPlus,
  welcome: Sparkles,
  project: Briefcase,
  task_assigned: ClipboardList,
  task_done: CheckCircle2,
  sprint: Flag,
  invite_accepted: MailCheck,
  role: Shield,
  deadline: Clock,
  risk: AlertTriangle,
  default: Bell,
};

const KIND_ACCENT: Record<NotificationUiKind, string> = {
  workspace: 'notif-accent--violet',
  invite: 'notif-accent--indigo',
  welcome: 'notif-accent--emerald',
  project: 'notif-accent--blue',
  task_assigned: 'notif-accent--amber',
  task_done: 'notif-accent--green',
  sprint: 'notif-accent--purple',
  invite_accepted: 'notif-accent--teal',
  role: 'notif-accent--slate',
  deadline: 'notif-accent--orange',
  risk: 'notif-accent--red',
  default: 'notif-accent--muted',
};

export function getNotificationIcon(kind: NotificationUiKind): LucideIcon {
  return KIND_ICONS[kind] ?? Bell;
}

export function getNotificationAccentClass(kind: NotificationUiKind): string {
  return KIND_ACCENT[kind] ?? KIND_ACCENT.default;
}

/** Single-letter or short initials from notification text */
export function notificationInitials(n: AppNotification): string {
  const msg = n.message || '';
  const m = msg.match(/félicitations\s+(\S)/i) || msg.match(/bonjour\s+(\S)/i);
  if (m?.[1]) return m[1].toUpperCase().slice(0, 1);
  const sujet = n.sujet || '';
  const words = sujet.replace(/[^A-Za-zÀ-ÿ\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase().slice(0, 2);
  }
  if (words.length === 1 && words[0].length >= 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return '?';
}

function metaNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
  return null;
}

/**
 * Always returns a route — never null — so every notification is clickable.
 */
export function resolveNotificationHref(n: AppNotification): string {
  const meta = parseNotificationMetadata(n.metadata);
  if (meta) {
    if (meta.action === 'approve_user') return '/approvals';

    const eid = metaNum(meta.enterpriseId);
    const pathRaw = meta.path;
    if (typeof pathRaw === 'string' && pathRaw.startsWith('/')) {
      if (pathRaw === '/enterprises' && eid != null) return `/enterprises/${eid}`;
      return pathRaw;
    }

    const pid = metaNum(meta.projectId);
    if (pid != null) return `/projects/${pid}`;

    const tid = metaNum(meta.taskId);
    if (tid != null) {
      const sujet = norm(n.sujet);
      const t = norm(n.type);
      if (sujet.includes('retard') || t === 'danger' || sujet.includes('alerte retard')) {
        return `/tasks?due=overdue&task=${tid}`;
      }
      return `/tasks?task=${tid}`;
    }
  }

  const sujet = norm(n.sujet);
  const msg = norm(n.message);
  const t = norm(n.type);
  const kind = classifyNotification(n);

  if (sujet.includes('inscription') || sujet.includes("demande d'inscription"))
    return '/approvals';

  if (
    kind === 'welcome' ||
    sujet.includes('compte activé') ||
    msg.includes('approuvé par le super admin') ||
    msg.includes('peut maintenant accéder')
  ) {
    return '/';
  }

  if (kind === 'invite_accepted' || sujet.includes('invitation acceptée')) return '/team';

  if (kind === 'workspace' || t === 'enterprise') return '/enterprises';

  if (kind === 'risk' || t === 'danger') return '/tasks?due=overdue';

  if (kind === 'project' || t === 'project') return '/projects';

  if (kind === 'invite') return '/team';

  if (kind === 'role') return '/settings';

  if (kind === 'sprint' || kind === 'task_assigned' || kind === 'task_done' || kind === 'deadline')
    return '/tasks';

  if (t === 'success' && msg.includes('entreprise')) return '/enterprises';

  if (t === 'user') return '/team';

  return '/';
}

export function formatNotificationTime(date: Date): string {
  const now = new Date();
  const ms = now.getTime() - date.getTime();
  if (ms < 0) return "À l'instant";

  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);

  const startOfDay = (x: Date) => {
    const t = new Date(x);
    t.setHours(0, 0, 0, 0);
    return t;
  };
  const today0 = startOfDay(now);
  const yesterday0 = new Date(today0);
  yesterday0.setDate(yesterday0.getDate() - 1);

  if (date >= today0) {
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    if (date.getDate() === now.getDate() && hours < 24) return `il y a ${hours} h`;
    return 'Aujourd\'hui';
  }
  if (date >= yesterday0 && date < today0) return 'Hier';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
