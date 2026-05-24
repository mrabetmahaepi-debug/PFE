import {
  isChefDeProjetMemberRole,
  normalizeProjectLocalRole,
} from "./projectRoleLabels";

type LocalRolePermCtx = {
  fullAccess: boolean;
  roleProjet: string | null;
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

/**
 * Task status may only be changed by a local « Développeur » on tasks assigned to them.
 * Local « Chef de projet » cannot change task status (even with legacy TASK_STATUS_ALL).
 */
export function localRoleAllowsTaskStatusChange(
  roleProjet: string | null | undefined,
  task: { assigne_a: number | null },
  userId: number
): boolean {
  if (isLocalChefDeProjet(roleProjet)) return false;
  if (!isLocalDeveloppeur(roleProjet)) return false;
  return task.assigne_a != null && Number(task.assigne_a) === userId;
}

export function assertCanChangeTaskStatusByLocalRole(
  ctx: LocalRolePermCtx,
  task: { assigne_a: number | null },
  userId: number
): void {
  if (ctx.fullAccess) return;
  if (localRoleAllowsTaskStatusChange(ctx.roleProjet, task, userId)) return;

  const err = new Error(
    isLocalChefDeProjet(ctx.roleProjet)
      ? "Le chef de projet ne peut pas modifier le statut des tâches."
      : "Seul le développeur assigné peut modifier le statut de cette tâche."
  );
  (err as any).status = 403;
  (err as any).code = "PROJECT_PERMISSION_DENIED";
  throw err;
}
