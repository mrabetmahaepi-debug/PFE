import i18n from '../i18n/config';

/** Dispatched after sidebar hierarchy changes that should refresh the workspace view. */
export const WORKSPACE_REFRESH_EVENT = 'virtide:workspace-refresh';

/** Dispatched when project list changes (create, edit, archive, delete). */
export const PROJECTS_UPDATED_EVENT = 'projects:updated';

export function dispatchWorkspaceRefresh(): void {
  window.dispatchEvent(new CustomEvent(WORKSPACE_REFRESH_EVENT));
}

/** Refresh projects page and Mon espace sidebar hierarchy. */
export function dispatchProjectsUpdated(): void {
  window.dispatchEvent(new CustomEvent(PROJECTS_UPDATED_EVENT));
  dispatchWorkspaceRefresh();
}

/** Refresh project statistics (cards, detail, sidebar counters) after task changes. */
export const PROJECT_TASK_STATS_CHANGED_EVENT = 'virtide:project-task-stats-changed';

export type ProjectTaskStatsChangedDetail = { projectId?: number };

export function dispatchProjectTaskStatsChanged(
  detail: ProjectTaskStatsChangedDetail = {}
): void {
  window.dispatchEvent(
    new CustomEvent<ProjectTaskStatsChangedDetail>(
      PROJECT_TASK_STATS_CHANGED_EVENT,
      { detail }
    )
  );
  dispatchProjectsUpdated();
}

/** Dispatched when enterprise project-role permissions matrix is saved. */
export const PROJECT_PERMISSIONS_CHANGED_EVENT =
  'virtide:project-permissions-changed';

export function dispatchProjectPermissionsChanged(): void {
  window.dispatchEvent(new CustomEvent(PROJECT_PERMISSIONS_CHANGED_EVENT));
  dispatchWorkspaceRefresh();
}

/** Message when an action is denied (follows current app language). */
export function getPermissionDeniedMessage(): string {
  return i18n.t('errors.permissionDenied');
}

/** @deprecated Use getPermissionDeniedMessage() for translated text. */
export const PERMISSION_DENIED_MESSAGE = "Vous n'avez pas l'autorisation nécessaire";

/** Dispatched when a task title is saved — sidebar patches in place (no full reload). */
export const TASK_RENAMED_EVENT = 'virtide:task-renamed';

export type TaskRenamedDetail = { taskId: number; nom_t: string };

export function dispatchTaskRenamed(taskId: number, nom_t: string): void {
  window.dispatchEvent(
    new CustomEvent<TaskRenamedDetail>(TASK_RENAMED_EVENT, {
      detail: { taskId, nom_t },
    })
  );
}

/** Dispatched when a subtask is deleted — sidebar patches in place. */
export const TASK_DELETED_EVENT = 'virtide:task-deleted';

export type TaskDeletedDetail = { taskId: number };

export function dispatchTaskDeleted(taskId: number): void {
  window.dispatchEvent(
    new CustomEvent<TaskDeletedDetail>(TASK_DELETED_EVENT, {
      detail: { taskId },
    })
  );
}

/** Dispatched when the member inbox mutates notifications (delete, mark read, etc.). */
export const NOTIFICATIONS_REFRESH_EVENT = 'virtide:notifications-refresh';

export type NotificationsRefreshDetail = {
  /** Mise à jour optimiste du badge sans refetch. */
  unreadCount?: number;
};

export function dispatchNotificationsRefresh(
  detail?: NotificationsRefreshDetail
): void {
  window.dispatchEvent(
    new CustomEvent<NotificationsRefreshDetail>(NOTIFICATIONS_REFRESH_EVENT, {
      detail: detail ?? {},
    })
  );
}

/** Dispatched when corbeille contents change (soft delete, restore, permanent delete). */
export const TRASH_REFRESH_EVENT = 'virtide:trash-refresh';

export function dispatchTrashRefresh(): void {
  window.dispatchEvent(new CustomEvent(TRASH_REFRESH_EVENT));
}

/** Dispatched when l'équipe ou le rôle projet d'un membre change. */
export const PROJECT_TEAM_CHANGED_EVENT = 'virtide:project-team-changed';

export type ProjectTeamChangedDetail = {
  projectId?: number;
  userId?: number;
};

export function dispatchProjectTeamChanged(
  detail: ProjectTeamChangedDetail = {}
): void {
  window.dispatchEvent(
    new CustomEvent<ProjectTeamChangedDetail>(PROJECT_TEAM_CHANGED_EVENT, {
      detail,
    })
  );
}
