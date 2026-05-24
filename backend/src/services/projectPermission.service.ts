import type { Request } from "express";
import prisma from "../prisma/prismaClient";
import type { AuthedUser } from "../middleware/permissions";
import { getUserPermissions, isSuperAdmin } from "../middleware/permissions";
import { isGlobalMembreUser, isTenantAdminUser } from "../lib/projectAccess";
import {
  ALL_PROJECT_PERMISSIONS_SET,
} from "../lib/projectRolePermissions";
import { permissionSetHas } from "../lib/permissionProfiles";
import {
  isChefDeProjetMemberRole,
  normalizeProjectLocalRole,
  resolveProjectPosteLabel,
} from "../lib/projectRoleLabels";
import { resolvePermissionsForUserProfile } from "./permissionProfile.service";
import {
  loadMemberPermissionOverrides,
  mergePermissionOverrides,
} from "../lib/memberProjectPermissionResolution";
import {
  assertCanChangeTaskStatusByLocalRole,
  bodyChangesTaskStatus,
} from "../lib/projectLocalRolePermissions";

const CHEF_DE_PROJET_ROLE_LABEL = "Chef de projet";

export type ProjectPermissionContext = {
  projectId: number;
  /** SuperAdmin or tenant Admin on this project's enterprise — all project perms. */
  fullAccess: boolean;
  /** `membre_projet.role_projet` uniquement (pas d'inférence depuis affectations / tâches). */
  roleProjet: string | null;
  permissions: ReadonlySet<string>;
};

export function hasProjectPermission(
  ctx: ProjectPermissionContext,
  permission: string
): boolean {
  if (ctx.fullAccess) return true;
  return permissionSetHas(ctx.permissions, permission);
}

/** Project permissions that allow creating/editing lists (aligned with task/sprint work). */
export const PROJECT_LIST_WRITE_PERMISSIONS = [
  "TASK_CREATE",
  "SPRINT_CREATE",
  "SPRINT_MANAGE",
  "create_tasks",
  "create_sprints",
  "manage_sprints",
] as const;

export async function userCanWriteListsOnProject(
  user: AuthedUser & { id: number },
  projectId: number
): Promise<boolean> {
  if (!Number.isFinite(projectId) || projectId < 1) return false;
  const ctx = await getProjectPermissionContext(user, projectId);
  if (ctx.fullAccess) return true;
  return PROJECT_LIST_WRITE_PERMISSIONS.some((p) => hasProjectPermission(ctx, p));
}

/** Global LIST_MANAGE or project-scoped list/task/sprint write permissions. */
export async function requestCanWriteLists(
  req: Request,
  projectId: number
): Promise<boolean> {
  const user = (req as any).user as (AuthedUser & { id: number }) | undefined;
  if (!user?.id) return false;
  if (isSuperAdmin(user)) return true;
  const global = await getUserPermissions(req);
  if (global === null) return true;
  if (global.has("LIST_MANAGE")) return true;
  return userCanWriteListsOnProject(user, projectId);
}

/** French message returned on permission denial (API + thrown errors). */
export const PERMISSION_DENIED_MESSAGE =
  "Vous n'avez pas l'autorisation nécessaire.";

/** Serializes project role + permission list for GET /projets/:id and /tree. */
export function serializeWorkspaceProjectAuth(
  _user: AuthedUser & { id: number },
  ctx: ProjectPermissionContext
): { currentUserProjectRole: string | null; currentUserPermissions: string[] } {
  return {
    currentUserProjectRole: ctx.roleProjet,
    currentUserPermissions: Array.from(ctx.permissions),
  };
}

export async function getProjectPermissionContext(
  user: AuthedUser & { id: number },
  projectId: number
): Promise<ProjectPermissionContext> {
  const pid = Number(projectId);
  if (!Number.isFinite(pid) || pid < 1) {
    return {
      projectId: pid,
      fullAccess: false,
      roleProjet: null,
      permissions: new Set(),
    };
  }

  if (isSuperAdmin(user)) {
    return {
      projectId: pid,
      fullAccess: true,
      roleProjet: null,
      permissions: ALL_PROJECT_PERMISSIONS_SET,
    };
  }

  const projet = await prisma.projet.findUnique({
    where: { id_projet: pid },
    select: { id_entreprise: true, chef_de_projet_id: true },
  });

  if (!projet) {
    return {
      projectId: pid,
      fullAccess: false,
      roleProjet: null,
      permissions: new Set(),
    };
  }

  if (
    isTenantAdminUser(user) &&
    projet.id_entreprise != null &&
    projet.id_entreprise === user.id_entreprise
  ) {
    return {
      projectId: pid,
      fullAccess: true,
      roleProjet: null,
      permissions: ALL_PROJECT_PERMISSIONS_SET,
    };
  }

  const row = await prisma.membre_projet.findFirst({
    where: { id_projet: pid, id_utilisateur: user.id },
    select: { role_projet: true },
  });

  if (!row) {
    const isChefResponsible =
      projet.chef_de_projet_id != null &&
      projet.chef_de_projet_id === user.id;
    if (!isChefResponsible) {
      return {
        projectId: pid,
        fullAccess: false,
        roleProjet: null,
        permissions: new Set(),
      };
    }
  }

  /** Local project role only — never global utilisateur.poste. */
  const localRoleRaw =
    row?.role_projet?.trim() ||
    (projet.chef_de_projet_id === user.id ? CHEF_DE_PROJET_ROLE_LABEL : null);

  const localRoleLabel =
    localRoleRaw && isChefDeProjetMemberRole(localRoleRaw)
      ? CHEF_DE_PROJET_ROLE_LABEL
      : localRoleRaw
        ? normalizeProjectLocalRole(localRoleRaw)
        : resolveProjectPosteLabel(localRoleRaw ?? "Membre");

  const entrepriseId =
    projet.id_entreprise != null ? Number(projet.id_entreprise) : null;

  const profilePermissions =
    entrepriseId != null && Number.isFinite(entrepriseId) && localRoleRaw
      ? await resolvePermissionsForUserProfile(entrepriseId, localRoleRaw)
      : [];

  const basePermissions = new Set(profilePermissions);

  const overrides = await loadMemberPermissionOverrides(user.id, pid);
  const permissions =
    overrides.length > 0
      ? mergePermissionOverrides(basePermissions, overrides)
      : basePermissions;

  return {
    projectId: pid,
    fullAccess: false,
    roleProjet: localRoleLabel,
    permissions,
  };
}

export function assertProjectPermission(
  ctx: ProjectPermissionContext,
  permission: string
): void {
  if (!hasProjectPermission(ctx, permission)) {
    denyProjectPermission();
  }
}

function denyProjectPermission(): never {
  const err = new Error(PERMISSION_DENIED_MESSAGE);
  (err as any).status = 403;
  (err as any).code = "PROJECT_PERMISSION_DENIED";
  throw err;
}

function meaningfulTaskUpdateKeys(body: Record<string, unknown>): string[] {
  return Object.keys(body || {}).filter((k) => body[k] !== undefined);
}

function isPriorityOnlyPatch(body: Record<string, unknown>): boolean {
  const keys = meaningfulTaskUpdateKeys(body);
  return (
    keys.length > 0 &&
    keys.every((k) => ["priorite_t", "priorite", "priority"].includes(k))
  );
}

/** Global « Membre » assignee — priority-only patch (Mes tâches → Assigné à moi). */
export function canGlobalMemberUpdateOwnTaskPriority(
  user: AuthedUser & { id: number },
  task: { assigne_a: number | null },
  body: Record<string, unknown>
): boolean {
  if (!isGlobalMembreUser(user)) return false;
  if (task.assigne_a == null || Number(task.assigne_a) !== user.id) return false;
  return isPriorityOnlyPatch(body);
}

export function assertCanCreateTask(ctx: ProjectPermissionContext): void {
  assertProjectPermission(ctx, "TASK_CREATE");
}

export function assertCanViewTasks(ctx: ProjectPermissionContext): void {
  if (hasProjectPermission(ctx, "TASK_VIEW")) return;
  assertProjectPermission(ctx, "PROJECT_VIEW");
}

export function assertCanDeleteTask(ctx: ProjectPermissionContext): void {
  assertProjectPermission(ctx, "TASK_DELETE");
}

/** Delete a subtask — parent task must remain; broader than root task delete for assignees. */
export function assertCanDeleteSubtask(
  ctx: ProjectPermissionContext,
  subtask: { assigne_a: number | null },
  userId: number,
  parentTask?: { assigne_a: number | null } | null
): void {
  if (ctx.fullAccess) return;
  if (hasProjectPermission(ctx, "TASK_DELETE")) return;
  if (hasProjectPermission(ctx, "TASK_EDIT_ALL")) return;

  const subAssignee =
    subtask.assigne_a != null && Number(subtask.assigne_a) === userId;
  const parentAssignee =
    parentTask?.assigne_a != null &&
    Number(parentTask.assigne_a) === userId;

  if (
    hasProjectPermission(ctx, "TASK_EDIT_ASSIGNED") &&
    (subAssignee || parentAssignee)
  ) {
    return;
  }

  if (hasProjectPermission(ctx, "TASK_CREATE")) return;

  denyProjectPermission();
}

export function assertCanAssignTask(ctx: ProjectPermissionContext): void {
  assertProjectPermission(ctx, "TASK_ASSIGN");
}

/** Task comments — project members, assignees, or explicit comment_tasks permission. */
export async function assertCanCommentOnTask(
  ctx: ProjectPermissionContext,
  userId: number,
  task: { assigne_a: number | null },
  projectId: number
): Promise<void> {
  if (ctx.fullAccess) return;
  if (hasProjectPermission(ctx, "comment_tasks")) return;
  if (hasProjectPermission(ctx, "edit_all_tasks")) return;
  if (
    hasProjectPermission(ctx, "edit_assigned_tasks") &&
    task.assigne_a != null &&
    Number(task.assigne_a) === userId
  ) {
    return;
  }
  if (task.assigne_a != null && Number(task.assigne_a) === userId) return;

  const membership = await prisma.membre_projet.findFirst({
    where: {
      id_projet: projectId,
      id_utilisateur: userId,
    },
    select: { id_membre_projet: true },
  });
  if (membership) return;

  denyProjectPermission();
}

/** Delete task comment — author, or project managers (fullAccess / edit_all_tasks). */
export function assertCanDeleteTaskComment(
  ctx: ProjectPermissionContext,
  userId: number,
  commentAuthorId: number
): void {
  if (ctx.fullAccess) return;
  if (hasProjectPermission(ctx, "edit_all_tasks")) return;
  if (hasProjectPermission(ctx, "delete_tasks")) return;
  if (Number(commentAuthorId) === userId) return;

  denyProjectPermission();
}

/**
 * Task update rules (UML permissions only):
 * - TASK_ASSIGN → change assignee
 * - TASK_EDIT_ALL → edit any other field
 * - TASK_EDIT_ASSIGNED → edit fields on tasks assigned to the current user
 * - TASK_STATUS_ALL / TASK_STATUS_OWN → status-only updates when edit rights are narrower
 */
export function assertCanUpdateTask(
  ctx: ProjectPermissionContext,
  task: { assigne_a: number | null; id_projet: number | null },
  body: Record<string, unknown>,
  userId: number
): void {
  if (ctx.fullAccess) return;

  if (bodyChangesTaskStatus(body)) {
    assertCanChangeTaskStatusByLocalRole(ctx, task, userId);
  }

  const assigneeId =
    task.assigne_a == null ? null : Number(task.assigne_a);
  const isAssignee = assigneeId === userId;

  const rawAssignee = body.assigne_a;
  const nextAssignee =
    rawAssignee === undefined
      ? undefined
      : rawAssignee === null
        ? null
        : Number(rawAssignee);
  const assigneeChanges =
    nextAssignee !== undefined &&
    (nextAssignee ?? null) !== (assigneeId ?? null);

  const keys = meaningfulTaskUpdateKeys(body);
  const otherKeys = keys.filter(
    (k) =>
      !["assigne_a", "assignee", "assigneeId"].includes(k) &&
      !["statut_t", "statut_tache", "statut", "status"].includes(k)
  );

  if (assigneeChanges && !hasProjectPermission(ctx, "TASK_ASSIGN")) {
    denyProjectPermission();
  }

  if (otherKeys.length > 0) {
    if (hasProjectPermission(ctx, "TASK_EDIT_ALL")) {
      return;
    }
    if (isAssignee && hasProjectPermission(ctx, "TASK_EDIT_ASSIGNED")) {
      return;
    }
    denyProjectPermission();
  }

  if (assigneeChanges && hasProjectPermission(ctx, "TASK_ASSIGN")) {
    return;
  }

  if (keys.length === 0) return;

  if (bodyChangesTaskStatus(body)) {
    return;
  }

  denyProjectPermission();
}

export async function getProjectIdForTask(taskId: number): Promise<number | null> {
  const t = await prisma.tache.findUnique({
    where: { id_tache: taskId },
    select: { id_projet: true },
  });
  if (!t?.id_projet) return null;
  return Number(t.id_projet);
}

export async function getProjectIdForSprint(sprintId: number): Promise<number | null> {
  const s = await prisma.sprint.findUnique({
    where: { id_sprint: sprintId },
    select: { id_projet: true },
  });
  if (!s?.id_projet) return null;
  return Number(s.id_projet);
}

export async function getProjectIdForList(listId: number): Promise<number | null> {
  const l = await (prisma as any).list_pm.findUnique({
    where: { id_list: listId },
    select: { id_projet: true },
  });
  if (!l?.id_projet) return null;
  return Number(l.id_projet);
}

/** PATCH /mes-taches/:id/statut — caller must be assignee; project perms apply. */
export function assertCanUpdateAssignedTaskStatus(
  ctx: ProjectPermissionContext,
  task: { assigne_a: number | null },
  userId: number
): void {
  if (task.assigne_a == null || Number(task.assigne_a) !== userId) {
    const err = new Error("Cette tâche ne vous est pas assignée");
    (err as any).status = 400;
    throw err;
  }
  assertCanChangeTaskStatusByLocalRole(ctx, task, userId);
}

async function loadUserForProjectAuth(
  userId: number
): Promise<(AuthedUser & { id: number }) | null> {
  const u = await prisma.utilisateur.findUnique({
    where: { id_utilisateur: userId },
    select: {
      id_utilisateur: true,
      email: true,
      id_role: true,
      id_entreprise: true,
      role: { select: { nom: true } },
    },
  });
  if (!u) return null;
  return {
    id: u.id_utilisateur,
    email: u.email ?? undefined,
    id_role: u.id_role,
    id_entreprise: u.id_entreprise,
    role: u.role?.nom ?? null,
  };
}

/** Liste des slugs de permissions effectives pour un couple (utilisateur, projet). */
export async function getProjectPermissions(
  userId: number,
  projectId: number
): Promise<string[]> {
  const u = await loadUserForProjectAuth(userId);
  if (!u) return [];
  const ctx = await getProjectPermissionContext(u, projectId);
  return Array.from(ctx.permissions);
}

/**
 * Vérifie une permission pour un utilisateur donné (par ids).
 * Ne pas confondre avec `hasProjectPermission(ctx, permission)` qui prend un contexte déjà résolu.
 */
export async function hasProjectPermissionForUser(
  userId: number,
  projectId: number,
  permission: string
): Promise<boolean> {
  const list = await getProjectPermissions(userId, projectId);
  return list.includes(permission);
}
