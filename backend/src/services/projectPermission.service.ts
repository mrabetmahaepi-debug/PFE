import prisma from "../prisma/prismaClient";
import type { AuthedUser } from "../middleware/permissions";
import { isSuperAdmin } from "../middleware/permissions";
import { isGlobalMembreUser, isTenantAdminUser } from "../lib/projectAccess";
import {
  ALL_PROJECT_PERMISSIONS_SET,
  getDefaultPermissionsForProjectRole,
  normalizeProjectRoleBucket,
} from "../lib/projectRolePermissions";
import { resolvePermissionsForProjectRoleLabel } from "./enterpriseProjectRoleConfig.service";

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
  return ctx.permissions.has(permission);
}

/** Permissions returned to the workspace UI for global « Membre » non-chef (hide management bundle). */
const WORKSPACE_PRIVILEGED_KEYS = new Set([
  "create_tasks",
  "manage_sprints",
  "create_sprints",
  "view_project",
]);

/**
 * Serializes project role + permission list for GET /projets/:id and /tree.
 * Global tenant members who are not « Chef de projet » in this project do not
 * receive workspace management slugs in the payload (actual ACL stays full ctx).
 */
export function serializeWorkspaceProjectAuth(
  user: AuthedUser & { id: number },
  ctx: ProjectPermissionContext
): { currentUserProjectRole: string | null; currentUserPermissions: string[] } {
  const role = ctx.roleProjet;
  let perms = Array.from(ctx.permissions);
  if (!ctx.fullAccess && isGlobalMembreUser(user)) {
    const bucket = normalizeProjectRoleBucket(role);
    if (bucket !== "CHEF") {
      perms = perms.filter((p) => !WORKSPACE_PRIVILEGED_KEYS.has(p));
    }
  }
  return { currentUserProjectRole: role, currentUserPermissions: perms };
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
    return {
      projectId: pid,
      fullAccess: false,
      roleProjet: null,
      permissions: new Set(),
    };
  }

  let roleLabel = row.role_projet?.trim() || "Membre";
  if (projet.chef_de_projet_id != null && projet.chef_de_projet_id === user.id) {
    roleLabel = "Chef de Projet";
  }

  const entrepriseId =
    projet.id_entreprise != null ? Number(projet.id_entreprise) : null;
  const permissions =
    entrepriseId != null && Number.isFinite(entrepriseId)
      ? await resolvePermissionsForProjectRoleLabel(entrepriseId, roleLabel)
      : getDefaultPermissionsForProjectRole(roleLabel);

  return {
    projectId: pid,
    fullAccess: false,
    roleProjet: roleLabel,
    permissions,
  };
}

export function assertProjectPermission(
  ctx: ProjectPermissionContext,
  permission: string
): void {
  if (!hasProjectPermission(ctx, permission)) {
    const err = new Error("Permission projet insuffisante");
    (err as any).status = 403;
    (err as any).code = "PROJECT_PERMISSION_DENIED";
    (err as any).requiredPermission = permission;
    throw err;
  }
}

function meaningfulTaskUpdateKeys(body: Record<string, unknown>): string[] {
  return Object.keys(body || {}).filter((k) => body[k] !== undefined);
}

export function assertCanCreateTask(ctx: ProjectPermissionContext): void {
  assertProjectPermission(ctx, "create_tasks");
}

export function assertCanViewTasks(ctx: ProjectPermissionContext): void {
  if (hasProjectPermission(ctx, "view_tasks")) return;
  assertProjectPermission(ctx, "view_project");
}

export function assertCanDeleteTask(ctx: ProjectPermissionContext): void {
  assertProjectPermission(ctx, "delete_tasks");
}

export function assertCanAssignTask(ctx: ProjectPermissionContext): void {
  assertProjectPermission(ctx, "assign_tasks");
}

/**
 * Rules:
 * - fullAccess or edit_all_tasks → any field (assignee change needs assign_tasks unless covered by edit_all + assign bundled for chef).
 * - assignee change → assign_tasks (always enforced except when caller has no assign change).
 * - status-only → change_task_status OR (change_own_task_status && assignee is current user).
 * - assignee is current user + edit_assigned_tasks → other field updates allowed.
 */
export function assertCanUpdateTask(
  ctx: ProjectPermissionContext,
  task: { assigne_a: number | null; id_projet: number | null },
  body: Record<string, unknown>,
  userId: number
): void {
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

  if (ctx.fullAccess || hasProjectPermission(ctx, "edit_all_tasks")) {
    return;
  }

  if (assigneeChanges && !hasProjectPermission(ctx, "assign_tasks")) {
    const err = new Error(
      "Vous ne pouvez pas réassigner cette tâche (permission assign_tasks requise)."
    );
    (err as any).status = 403;
    (err as any).code = "PROJECT_PERMISSION_DENIED";
    throw err;
  }

  const keys = meaningfulTaskUpdateKeys(body);
  const onlyStatus =
    keys.length > 0 &&
    keys.every((k) =>
      ["statut_t", "statut_tache", "statut"].includes(k)
    );

  if (onlyStatus && keys.some((k) => k.startsWith("statut"))) {
    if (hasProjectPermission(ctx, "change_task_status")) return;
    if (
      isAssignee &&
      hasProjectPermission(ctx, "change_own_task_status")
    ) {
      return;
    }
    const err = new Error(
      "Vous ne pouvez pas modifier le statut de cette tâche."
    );
    (err as any).status = 403;
    (err as any).code = "PROJECT_PERMISSION_DENIED";
    throw err;
  }

  if (isAssignee && hasProjectPermission(ctx, "edit_assigned_tasks")) {
    return;
  }

  const err = new Error("Vous ne pouvez pas modifier cette tâche.");
  (err as any).status = 403;
  (err as any).code = "PROJECT_PERMISSION_DENIED";
  throw err;
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
  if (ctx.fullAccess) return;
  if (hasProjectPermission(ctx, "change_task_status")) return;
  if (hasProjectPermission(ctx, "change_own_task_status")) return;
  if (hasProjectPermission(ctx, "edit_assigned_tasks")) return;
  if (hasProjectPermission(ctx, "edit_all_tasks")) return;
  const err = new Error("Vous ne pouvez pas modifier le statut de cette tâche.");
  (err as any).status = 403;
  (err as any).code = "PROJECT_PERMISSION_DENIED";
  throw err;
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
