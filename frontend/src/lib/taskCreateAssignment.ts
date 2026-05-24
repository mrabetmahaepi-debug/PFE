import type { User } from '../types/auth.types';
import {
  isEnterpriseAdmin,
  isSuperAdmin,
} from './permissions';
import {
  normalizeProjectManageContext,
  resolveUserNumericId,
  type ProjectManageContext,
} from './projectManageAccess';
import { localRoleCanAssignTasks } from './projectLocalRolePermissions';

/** Admin or local « Chef de projet » on this project picks assignee when creating tasks. */
export function shouldPickTaskAssigneeOnCreate(
  user?: User | null,
  project?: ProjectManageContext | Record<string, unknown> | null
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user) || isEnterpriseAdmin(user)) return true;
  const ctx = normalizeProjectManageContext(project);
  return localRoleCanAssignTasks(ctx?.currentUserProjectRole);
}

export function resolveCreateTaskAssigneeId(
  user: User | null | undefined,
  project: ProjectManageContext | Record<string, unknown> | null | undefined,
  selectedAssigneeId: string,
  projectMemberIds: number[]
): { assigneeId: number } | { error: string } {
  const ctx = normalizeProjectManageContext(project);
  const uid = resolveUserNumericId(user);

  if (!shouldPickTaskAssigneeOnCreate(user, ctx)) {
    if (!uid) {
      return { error: 'Session invalide. Reconnectez-vous.' };
    }
    if (projectMemberIds.length > 0 && !projectMemberIds.includes(uid)) {
      return {
        error: 'Vous devez être membre du projet pour créer une tâche.',
      };
    }
    return { assigneeId: uid };
  }

  const aid = Number(selectedAssigneeId);
  if (!Number.isFinite(aid) || aid < 1) {
    return { error: 'Veuillez sélectionner un membre du projet.' };
  }
  if (projectMemberIds.length > 0 && !projectMemberIds.includes(aid)) {
    return { error: "Ce membre n'appartient pas au projet." };
  }
  return { assigneeId: aid };
}

export function mapTaskCreateErrorMessage(raw: string): string {
  const msg = String(raw ?? '').trim();
  if (!msg) return 'Impossible de créer la tâche.';
  if (/permission|autorisation|403/i.test(msg)) {
    return "Vous n'avez pas l'autorisation de créer une tâche dans ce projet.";
  }
  return msg;
}
