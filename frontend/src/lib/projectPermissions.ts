import type { SpaceTreeNode, TreeProjectNode } from '../types/hierarchy';

import type { Tache } from '../types/task';

import { permissionSetHas } from './permissionCheck';
import {
  isLocalChefDeProjet,
  isLocalDeveloppeur,
  localRoleCanChangeTaskStatus,
} from './projectLocalRolePermissions';



/** Project-scoped permission check (UML + legacy slugs). */

export function projectCan(

  permissions: string[] | undefined | null,

  key: string

): boolean {

  return permissionSetHas(permissions, key);

}



const LIST_WRITE_KEYS = [

  'TASK_CREATE',

  'SPRINT_CREATE',

  'SPRINT_MANAGE',

  'create_tasks',

  'create_sprints',

  'manage_sprints',

] as const;



export function canCreateTasksInProject(

  permissions: string[] | undefined | null

): boolean {

  return projectCan(permissions, 'TASK_CREATE');

}



export function canDeleteSubtasksInProject(

  permissions: string[] | undefined | null

): boolean {

  return (

    projectCan(permissions, 'TASK_DELETE') ||

    projectCan(permissions, 'TASK_EDIT_ALL') ||

    projectCan(permissions, 'TASK_EDIT_ASSIGNED') ||

    projectCan(permissions, 'TASK_CREATE')

  );

}



export function canCreateSprintsInProject(

  permissions: string[] | undefined | null

): boolean {

  return (

    projectCan(permissions, 'SPRINT_CREATE') ||

    projectCan(permissions, 'SPRINT_MANAGE')

  );

}



/** Strict create — « + Ajouter Sprint » (SPRINT_CREATE only, not role-based). */

export function canCreateSprintInProject(

  permissions: string[] | undefined | null

): boolean {

  if (!permissions?.length) return false;

  const set = new Set(permissions);

  return set.has('SPRINT_CREATE') || set.has('create_sprints');

}



export function canCreateListsInProject(

  permissions: string[] | undefined | null

): boolean {

  return LIST_WRITE_KEYS.some((k) => projectCan(permissions, k));

}



export function canManageSprintsInProject(

  permissions: string[] | undefined | null

): boolean {

  return (

    projectCan(permissions, 'SPRINT_MANAGE') ||

    projectCan(permissions, 'SPRINT_CREATE')

  );

}



export function canAssignTasksInProject(

  permissions: string[] | undefined | null

): boolean {

  return projectCan(permissions, 'TASK_ASSIGN');

}



export function isTaskAssignee(

  task: Pick<Tache, 'assigne_a'>,

  userId: number | null | undefined

): boolean {

  return (

    userId != null &&

    task.assigne_a != null &&

    Number(task.assigne_a) === Number(userId)

  );

}



/** Merge project-scoped + session profile permissions. */

export function resolveEffectiveProjectPermissions(

  projectPermissions: string[] | undefined | null,

  globalPermissions: string[] | undefined | null

): string[] {

  const set = new Set<string>();

  for (const p of projectPermissions ?? []) set.add(p);

  for (const p of globalPermissions ?? []) set.add(p);

  return [...set];

}



/** Edit status, dates, priority, description, title on a task detail page. */

export function canEditTaskDetailFields(

  permissions: string[] | undefined | null,

  task: Tache,

  userId: number | null | undefined

): boolean {

  if (projectCan(permissions, 'TASK_EDIT_ALL')) return true;

  if (

    projectCan(permissions, 'TASK_EDIT_ASSIGNED') &&

    isTaskAssignee(task, userId)

  ) {

    return true;

  }

  return false;

}



export function canEditTasksInProject(
  permissions: string[] | undefined | null
): boolean {
  return (
    projectCan(permissions, 'TASK_EDIT_ALL') ||
    projectCan(permissions, 'TASK_EDIT_ASSIGNED') ||
    projectCan(permissions, 'TASK_STATUS_ALL') ||
    projectCan(permissions, 'TASK_STATUS_OWN')
  );
}



export function canEditProjectInProject(

  permissions: string[] | undefined | null

): boolean {

  return projectCan(permissions, 'PROJECT_EDIT');

}



export function canManageProjectTeamInProject(

  permissions: string[] | undefined | null

): boolean {

  return projectCan(permissions, 'TEAM_MANAGE');

}



export function canViewProjectInWorkspace(

  permissions: string[] | undefined | null

): boolean {

  return projectCan(permissions, 'PROJECT_VIEW');

}



export function findProjectInSpaces(

  spaces: SpaceTreeNode[],

  projectId: number

): TreeProjectNode | undefined {

  for (const space of spaces) {

    const project = space.projects?.find((p) => p.id_projet === projectId);

    if (project) return project;

  }

  return undefined;

}



export function projectPermissionsFromSpaces(

  spaces: SpaceTreeNode[],

  projectId: number | null | undefined

): string[] {

  if (projectId == null || !Number.isFinite(projectId)) return [];

  return findProjectInSpaces(spaces, projectId)?.currentUserPermissions ?? [];

}



export function canDeleteTaskComment(

  permissions: string[] | undefined | null,

  commentAuthorId: number,

  userId: number | null | undefined

): boolean {

  if (userId == null) return false;

  if (projectCan(permissions, 'TASK_EDIT_ALL')) return true;

  if (projectCan(permissions, 'TASK_DELETE')) return true;

  return Number(commentAuthorId) === Number(userId);

}



export function canChangeTaskStatusForTask(
  permissions: string[] | undefined | null,
  task: Tache,
  userId: number | null | undefined,
  options?: {
    localRole?: string | null;
    isAdmin?: boolean;
  }
): boolean {
  if (options?.isAdmin) return true;

  const role = options?.localRole;
  if (role != null && role !== '') {
    if (isLocalChefDeProjet(role) || isLocalDeveloppeur(role)) {
      return localRoleCanChangeTaskStatus(role, task, userId, permissions);
    }
  }

  if (projectCan(permissions, 'TASK_EDIT_ALL')) return true;
  if (projectCan(permissions, 'TASK_STATUS_ALL')) return true;
  if (
    projectCan(permissions, 'TASK_EDIT_ASSIGNED') &&
    isTaskAssignee(task, userId)
  ) {
    return true;
  }
  if (
    projectCan(permissions, 'TASK_STATUS_OWN') &&
    isTaskAssignee(task, userId)
  ) {
    return true;
  }
  return false;
}

