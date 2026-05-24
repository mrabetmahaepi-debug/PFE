import api from '../services/api';
import type { TaskComment } from '../types/taskActivity';

/** Debug rows inserted by dev scripts — never show in UI. */
const AUTOMATED_TEST_COMMENT = /^(?:test comment |http test )\d+$/i;

export function isAutomatedTestTaskComment(content: string): boolean {
  return AUTOMATED_TEST_COMMENT.test(String(content ?? '').trim());
}

/** API shape from POST/GET /tasks/:taskId/comments */
export type TaskCommentApiPayload = {
  id: number;
  taskId: number;
  content: string;
  createdAt: string;
  user: {
    id: number;
    nom: string | null;
    prenom: string | null;
    email: string | null;
  };
};

/** Map backend API → UI model (MemberTaskDetail list). */
export function normalizeTaskCommentFromApi(raw: unknown): TaskComment {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Réponse commentaire invalide');
  }
  const r = raw as Record<string, unknown>;

  const userRaw = (r.user ?? r.utilisateur) as Record<string, unknown> | undefined;
  const userId = Number(userRaw?.id ?? userRaw?.id_utilisateur ?? 0);
  const createdAtRaw = r.createdAt ?? (raw as TaskComment).createdAt;

  return {
    id_comment: Number(r.id ?? r.id_comment),
    id_tache: Number(r.taskId ?? r.id_tache),
    contenu: String(r.content ?? r.contenu ?? ''),
    createdAt:
      createdAtRaw != null && String(createdAtRaw).trim() !== ''
        ? String(createdAtRaw)
        : '',
    utilisateur: {
      id_utilisateur: userId,
      nom: (userRaw?.nom as string | null) ?? null,
      prenom: (userRaw?.prenom as string | null) ?? null,
      email: (userRaw?.email as string | null) ?? null,
    },
  };
}

export function normalizeTaskCommentsFromApi(raw: unknown): TaskComment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeTaskCommentFromApi)
    .filter((c) => !isAutomatedTestTaskComment(c.contenu));
}

/** Append a newly created comment without duplicates. */
export function appendTaskComment(
  prev: TaskComment[],
  created: TaskComment
): TaskComment[] {
  const id = created.id_comment;
  const withoutDup = prev.filter((c) => c.id_comment !== id);
  if (isAutomatedTestTaskComment(created.contenu)) {
    return withoutDup;
  }
  return [...withoutDup, created];
}

export async function deleteTaskComment(commentId: number): Promise<void> {
  const id = Number(commentId);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('ID de commentaire invalide');
  }
  await api.delete(`/comments/${id}`);
}

export function removeTaskCommentFromList(
  prev: TaskComment[],
  commentId: number
): TaskComment[] {
  return prev.filter((c) => c.id_comment !== commentId);
}
