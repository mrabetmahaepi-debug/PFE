import {
  isChefDeProjetMemberRole,
  normalizeProjectLocalRole,
} from './projectRoleLabels';
import type { Tache } from '../types/task';
import { isTaskAssignee } from './projectPermissions';
import { permissionSetHas } from './permissionCheck';

export function isLocalChefDeProjet(
  roleProjet: string | null | undefined
): boolean {
  return isChefDeProjetMemberRole(roleProjet);
}

export function isLocalDeveloppeur(
  roleProjet: string | null | undefined
): boolean {
  if (!roleProjet?.trim()) return false;
  if (isChefDeProjetMemberRole(roleProjet)) return false;
  return normalizeProjectLocalRole(roleProjet) === 'Développeur';
}

/** Local « Chef de projet » — create sprint/list/task, assign, manage team. */
export function localRoleCanCreateSprint(
  roleProjet: string | null | undefined
): boolean {
  return isLocalChefDeProjet(roleProjet);
}

export function localRoleCanCreateList(
  roleProjet: string | null | undefined
): boolean {
  return isLocalChefDeProjet(roleProjet);
}

export function localRoleCanCreateTask(
  roleProjet: string | null | undefined
): boolean {
  return isLocalChefDeProjet(roleProjet);
}

export function localRoleCanAssignTasks(
  roleProjet: string | null | undefined
): boolean {
  return isLocalChefDeProjet(roleProjet);
}

export function localRoleCanManageTeam(
  roleProjet: string | null | undefined
): boolean {
  return isLocalChefDeProjet(roleProjet);
}

export function localRoleCanEditProject(
  roleProjet: string | null | undefined
): boolean {
  return isLocalChefDeProjet(roleProjet);
}

/**
 * Status change for local project roles:
 * - Chef de projet: any task in the project
 * - Développeur: assigned tasks, or when TASK_STATUS_ALL / TASK_EDIT_ALL is granted
 */
export function localRoleCanChangeTaskStatus(
  roleProjet: string | null | undefined,
  task: Pick<Tache, 'assigne_a'>,
  userId: number | null | undefined,
  permissions?: string[] | null
): boolean {
  if (isLocalChefDeProjet(roleProjet)) return true;
  if (!isLocalDeveloppeur(roleProjet)) return false;
  if (isTaskAssignee(task, userId)) return true;
  if (permissionSetHas(permissions, 'TASK_STATUS_ALL')) return true;
  if (permissionSetHas(permissions, 'TASK_EDIT_ALL')) return true;
  return false;
}

export function localRoleCanEditAssignedTask(
  roleProjet: string | null | undefined,
  task: Pick<Tache, 'assigne_a'>,
  userId: number | null | undefined
): boolean {
  if (isLocalChefDeProjet(roleProjet)) return true;
  if (!isLocalDeveloppeur(roleProjet)) return false;
  return isTaskAssignee(task, userId);
}

export function projectLocalRoleFromSpaces(
  spaces: { projects?: { id_projet: number; currentUserProjectRole?: string | null }[] }[],
  projectId: number | null | undefined
): string | null {
  if (projectId == null || !Number.isFinite(projectId)) return null;
  for (const space of spaces) {
    const project = space.projects?.find((p) => p.id_projet === projectId);
    if (project?.currentUserProjectRole) return project.currentUserProjectRole;
  }
  return null;
}
