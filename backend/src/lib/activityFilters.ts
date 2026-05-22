/** Shared activity feed filtering by platform role. */

export type ActivityFeedRow = {
  type?: string | null;
  action?: string | null;
  user?: string | null;
  enterprise?: string | null;
  entreprise?: string | null;
};

/** Canonical SuperAdmin Activity History actions. */
export const SUPER_ADMIN_ALLOWED_ACTIONS = [
  "Compte administrateur approuvé",
  "Compte administrateur activé",
  "Compte administrateur désactivé",
  "Administrateur invité",
  "Entreprise créée",
] as const;

const ALLOWED_SET = new Set<string>(SUPER_ADMIN_ALLOWED_ACTIONS);

const ACTION_ALIASES: Record<string, string> = {
  "Admin invité": "Administrateur invité",
  "Nouvelle entreprise créée": "Entreprise créée",
  "Invitation administrateur approuvée": "Compte administrateur approuvé",
  "Administrator invited": "Administrateur invité",
  "Administrator account approved": "Compte administrateur approuvé",
  "Administrator account activated": "Compte administrateur activé",
  "Administrator account deactivated": "Compte administrateur désactivé",
  "Company created": "Entreprise créée",
};

export function normalizeSuperAdminAction(
  action: string | null | undefined
): string | null {
  const raw = String(action ?? "").trim();
  if (!raw) return null;
  if (ALLOWED_SET.has(raw)) return raw;
  return ACTION_ALIASES[raw] ?? null;
}

/** SuperAdmin Activity History — whitelist only. */
export function isSuperAdminPlatformActivity(row: ActivityFeedRow): boolean {
  return normalizeSuperAdminAction(row.action) != null;
}

const ENTERPRISE_ADMIN_BLOCKED_TYPES = new Set(["enterprise"]);

const ENTERPRISE_ADMIN_GLOBAL_ACTION_RE =
  /nouvelle entreprise|entreprise créée|entreprise supprimée|entreprise modifiée/i;

/** Tenant admin — workspace projects, tasks, team (same enterprise only). */
export function isEnterpriseAdminScopedActivity(
  row: ActivityFeedRow,
  enterpriseName: string
): boolean {
  const type = String(row.type ?? "info")
    .trim()
    .toLowerCase();
  const action = String(row.action ?? "").trim();
  const entName = enterpriseName.trim();
  const entField = String(row.enterprise ?? row.entreprise ?? "").trim();

  if (ENTERPRISE_ADMIN_BLOCKED_TYPES.has(type)) return false;

  if (
    String(row.user ?? "").trim() === "Super Admin" &&
    ENTERPRISE_ADMIN_GLOBAL_ACTION_RE.test(action)
  ) {
    return false;
  }

  if (ENTERPRISE_ADMIN_GLOBAL_ACTION_RE.test(action) && type !== "project") {
    return false;
  }

  const workspaceTypes = new Set([
    "project",
    "task",
    "user",
    "member",
    "access",
    "invitation",
    "info",
  ]);

  if (!workspaceTypes.has(type)) return false;

  if (/^projet:/i.test(entField)) return true;

  if (
    (type === "project" || type === "access") &&
    /accès projet|projet créé|nouveau projet|projet modifi/i.test(action)
  ) {
    return true;
  }

  if (!entName) return false;

  if (!entField || entField === "Plateforme") {
    return /projet|tâche|task|membre|accès|permission|invitation|admin invité/i.test(
      action
    );
  }

  return (
    entField === entName ||
    entField.includes(entName) ||
    entName.includes(entField)
  );
}

const MEMBER_BLOCKED_ACTION_RE =
  /entreprise créée|nouvelle entreprise|admin invité|invitation administrateur|permission globale|super admin/i;

/** Member dashboard — projects, tasks & team access in the member workspace. */
export function isMemberScopedActivity(row: ActivityFeedRow): boolean {
  const type = String(row.type ?? "info")
    .trim()
    .toLowerCase();
  const action = String(row.action ?? "").trim();
  if (!action || type === "enterprise") return false;
  if (MEMBER_BLOCKED_ACTION_RE.test(action)) return false;

  if (["task", "project", "access", "member"].includes(type)) return true;
  return /tâche|projet|accès projet|ajouté au projet|membre/i.test(action);
}
