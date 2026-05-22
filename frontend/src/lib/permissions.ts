/**
 * Frontend permission utilities.
 *
 * Single source of truth for:
 *  - role normalization (handles `string` vs `{ nom }` vs casing)
 *  - SuperAdmin detection
 *  - permission name constants used in UI
 *
 * Permission names mirror the backend catalog
 * (`backend/src/modules/permissions/permissions.catalog.ts`).
 */
import type { User } from "../types/auth.types";

export type RoleKey =
  | "SUPERADMIN"
  | "ADMIN"
  | "CHEF_DE_PROJET"
  | "MEMBRE"
  | "OTHER"
  | "GUEST";

export function getRoleName(user?: User | null): string | null {
  if (!user) return null;
  const r = user.role;
  if (!r) return null;
  if (typeof r === "string") return r;
  if (typeof r === "object" && r !== null && "nom" in r) {
    return (r as { nom?: string }).nom ?? null;
  }
  return null;
}

/** Aligns with backend `normalizeRoleForSuperAdminCompare`. */
export function normalizeRoleForSuperAdminCompare(
  role: string | null | undefined
): string {
  return String(role ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]/g, "");
}

export function getRoleKey(user?: User | null): RoleKey {
  if (!user) return "GUEST";
  const name = getRoleName(user) ?? "";
  if (normalizeRoleForSuperAdminCompare(name) === "SUPERADMIN") {
    return "SUPERADMIN";
  }
  const raw = name.trim().toUpperCase();
  if (raw === "ADMIN") return "ADMIN";
  if (raw === "CHEF DE PROJET" || raw === "CHEF_DE_PROJET") return "CHEF_DE_PROJET";
  if (raw === "MEMBRE" || raw === "MEMBER") return "MEMBRE";
  if (!raw) return "GUEST";
  return "OTHER";
}

export function isSuperAdmin(user?: User | null): boolean {
  if (!user) return false;
  if (user.isSuperAdmin === true) return true;
  return getRoleKey(user) === "SUPERADMIN";
}

/** Tenant enterprise admin (not SuperAdmin). Used for admin-only dashboard routing. */
/** Global tenant role « Membre » / « Member » (not project-scoped role_projet). */
export function isGlobalMember(user?: User | null): boolean {
  if (!user || isSuperAdmin(user) || isEnterpriseAdmin(user)) return false;
  return getRoleKey(user) === "MEMBRE";
}

export function isEnterpriseAdmin(user?: User | null): boolean {
  if (!user || isSuperAdmin(user)) return false;
  if (getRoleKey(user) === "ADMIN") return true;
  const norm = String(getRoleName(user) ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]/g, "");
  return (
    norm === "ADMIN" ||
    norm === "ADMINISTRATEUR" ||
    norm === "ADMINENTREPRISE"
  );
}

/**
 * Canonical permission constants.
 * Use these instead of string literals to avoid typos.
 */
export const PERM = {
  // Workspace
  WORKSPACE_VIEW: "WORKSPACE_VIEW",
  ENTERPRISE_EDIT: "ENTERPRISE_EDIT",
  ENTERPRISE_STATS: "ENTERPRISE_STATS",
  // Projects
  PROJECT_VIEW_ALL: "PROJECT_VIEW_ALL",
  PROJECT_CREATE: "PROJECT_CREATE",
  PROJECT_EDIT: "PROJECT_EDIT",
  PROJECT_DELETE: "PROJECT_DELETE",
  PROJECT_MANAGE_ACCESS: "PROJECT_MANAGE_ACCESS",
  // Tasks
  TASK_VIEW_ALL: "TASK_VIEW_ALL",
  TASK_CREATE: "TASK_CREATE",
  TASK_EDIT: "TASK_EDIT",
  TASK_DELETE: "TASK_DELETE",
  TASK_ASSIGN: "TASK_ASSIGN",
  // Sprints
  SPRINT_VIEW: "SPRINT_VIEW",
  SPRINT_MANAGE: "SPRINT_MANAGE",
  // Teams
  TEAM_VIEW: "TEAM_VIEW",
  TEAM_INVITE: "TEAM_INVITE",
  TEAM_MANAGE_ROLES: "TEAM_MANAGE_ROLES",
  TEAM_REMOVE_MEMBER: "TEAM_REMOVE_MEMBER",
  // Invitations
  INVITATION_VIEW: "INVITATION_VIEW",
  INVITATION_MANAGE: "INVITATION_MANAGE",
  // Messaging
  MESSAGING_USE: "MESSAGING_USE",
  MESSAGING_MANAGE_GROUPS: "MESSAGING_MANAGE_GROUPS",
  // Analytics
  ANALYTICS_VIEW: "ANALYTICS_VIEW",
  // AI
  AI_PREDICTIONS_VIEW: "AI_PREDICTIONS_VIEW",
  AI_PREDICTIONS_MANAGE: "AI_PREDICTIONS_MANAGE",
  // Billing
  BILLING_VIEW: "BILLING_VIEW",
  BILLING_MANAGE: "BILLING_MANAGE",
  // System
  SYSTEM_MANAGE_ALL: "SYSTEM_MANAGE_ALL",
  SYSTEM_MANAGE_ENTERPRISES: "SYSTEM_MANAGE_ENTERPRISES",
  SYSTEM_APPROVE_ADMINS: "SYSTEM_APPROVE_ADMINS",
  SYSTEM_VIEW_ACTIVITY_LOGS: "SYSTEM_VIEW_ACTIVITY_LOGS",
} as const;

export type PermissionName = (typeof PERM)[keyof typeof PERM];

/**
 * Pure permission check against a permission set + super-admin flag.
 * Used by both `usePermission` and `Can`.
 */
export function checkPermission(
  permission: string,
  permissions: string[] | Set<string> | undefined,
  superAdmin: boolean
): boolean {
  if (superAdmin) return true;
  if (!permissions) return false;
  if (permissions instanceof Set) return permissions.has(permission);
  return permissions.includes(permission);
}
