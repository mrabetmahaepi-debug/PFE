import {
  isChefDeProjetMemberRole,
  normalizeProjectLocalRole,
} from "./projectRoleLabels";
import { permissionSetHas } from "./permissionProfiles";

type StatusPermCtx = {
  fullAccess: boolean;
  roleProjet: string | null;
  permissions: ReadonlySet<string>;
};

const STATUS_FIELD_KEYS = new Set([
  "statut_t",
  "statut_tache",
  "statut",
  "status",
]);

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
  return normalizeProjectLocalRole(roleProjet) === "Développeur";
}

export function bodyChangesTaskStatus(body: Record<string, unknown>): boolean {
  return Object.keys(body || {}).some(
    (k) => body[k] !== undefined && STATUS_FIELD_KEYS.has(k)
  );
}

function ctxHasPermission(ctx: StatusPermCtx, permission: string): boolean {
  if (ctx.fullAccess) return true;
  return permissionSetHas(ctx.permissions, permission);
}

/**
 * Local role rules for task status:
 * - Chef de projet: may change any task status in the project
 * - Développeur: own assigned tasks, or when TASK_STATUS_ALL / TASK_EDIT_ALL is granted
 */
export function localRoleAllowsTaskStatusChange(
  ctx: StatusPermCtx,
  task: { assigne_a: number | null },
  userId: number
): boolean {
  if (ctx.fullAccess) return true;

  const role = ctx.roleProjet;
  if (isLocalChefDeProjet(role)) return true;

  if (!isLocalDeveloppeur(role)) return false;

  const isAssignee =
    task.assigne_a != null && Number(task.assigne_a) === userId;
  if (isAssignee) return true;
  if (ctxHasPermission(ctx, "TASK_STATUS_ALL")) return true;
  if (ctxHasPermission(ctx, "TASK_EDIT_ALL")) return true;
  return false;
}

/**
 * Assert the user may change task status (local roles + UML permissions).
 */
export function assertCanChangeTaskStatus(
  ctx: StatusPermCtx,
  task: { assigne_a: number | null },
  userId: number
): void {
  if (ctx.fullAccess) return;

  const assigneeId = task.assigne_a == null ? null : Number(task.assigne_a);
  const isAssignee = assigneeId === userId;
  const role = ctx.roleProjet;

  if (isLocalChefDeProjet(role) || isLocalDeveloppeur(role)) {
    if (localRoleAllowsTaskStatusChange(ctx, task, userId)) return;
    const err = new Error(
      "Seul le développeur assigné peut modifier le statut de cette tâche."
    );
    (err as any).status = 403;
    (err as any).code = "PROJECT_PERMISSION_DENIED";
    throw err;
  }

  if (ctxHasPermission(ctx, "TASK_EDIT_ALL")) return;
  if (ctxHasPermission(ctx, "TASK_STATUS_ALL")) return;
  if (
    isAssignee &&
    (ctxHasPermission(ctx, "TASK_EDIT_ASSIGNED") ||
      ctxHasPermission(ctx, "TASK_STATUS_OWN"))
  ) {
    return;
  }

  const err = new Error(
    "Vous n'avez pas l'autorisation de modifier le statut de cette tâche."
  );
  (err as any).status = 403;
  (err as any).code = "PROJECT_PERMISSION_DENIED";
  throw err;
}

/** @deprecated Use assertCanChangeTaskStatus */
export const assertCanChangeTaskStatusByLocalRole = assertCanChangeTaskStatus;
