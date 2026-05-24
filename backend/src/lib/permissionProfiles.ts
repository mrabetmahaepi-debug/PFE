/**
 * Permission profiles (UML) — Chef de projet / Développeur are profiles, not system roles.
 * Admin has implicit full access; Utilisateur permissions come from assigned profile.
 */

import { resolveProjectPosteLabel } from "./projectRoleLabels";

/** Stable profile keys stored in `entreprise_project_role_config.config_json`. */
export const PROFILE_KEYS = [
  "CHEF_PROJET",
  "DEVELOPPEUR",
  "DESIGNER",
  "TESTEUR",
  "ANALYSTE",
  "MEMBRE",
] as const;

export type PermissionProfileKey = (typeof PROFILE_KEYS)[number];

export const PROFILE_LABELS_FR: Record<PermissionProfileKey, string> = {
  CHEF_PROJET: "Chef de projet",
  DEVELOPPEUR: "Développeur",
  DESIGNER: "Designer",
  TESTEUR: "Testeur",
  ANALYSTE: "Analyste",
  MEMBRE: "Membre",
};

/** Default system profiles — UML permission names. */
export const DEFAULT_PROFILE_PERMISSIONS: Record<
  PermissionProfileKey,
  readonly string[]
> = {
  CHEF_PROJET: [
    "PROJECT_VIEW",
    "TASK_VIEW",
    "SPRINT_VIEW",
    "PROJECT_EDIT",
    "TEAM_MANAGE",
    "SPRINT_CREATE",
    "SPRINT_MANAGE",
    "TASK_CREATE",
    "TASK_EDIT_ALL",
    "TASK_ASSIGN",
    "TASK_VALIDATE",
    "REPORT_VIEW",
    "COMMENT_CREATE",
    "FILE_UPLOAD",
    "TASK_DELETE",
    "WORKSPACE_VIEW",
    "LIST_VIEW",
    "FOLDER_VIEW",
  ],
  DEVELOPPEUR: [
    "PROJECT_VIEW",
    "TASK_VIEW",
    "SPRINT_VIEW",
    "TASK_EDIT_ASSIGNED",
    "TASK_STATUS_OWN",
    "COMMENT_CREATE",
    "FILE_UPLOAD",
    "ANOMALY_REPORT",
    "WORKSPACE_VIEW",
    "LIST_VIEW",
    "FOLDER_VIEW",
  ],
  DESIGNER: [
    "PROJECT_VIEW",
    "TASK_VIEW",
    "TASK_EDIT_ASSIGNED",
    "TASK_STATUS_OWN",
    "COMMENT_CREATE",
    "FILE_UPLOAD",
    "WORKSPACE_VIEW",
    "LIST_VIEW",
  ],
  TESTEUR: [
    "PROJECT_VIEW",
    "TASK_VIEW",
    "TASK_STATUS_OWN",
    "TASK_VALIDATE",
    "COMMENT_CREATE",
    "ANOMALY_REPORT",
    "WORKSPACE_VIEW",
    "LIST_VIEW",
  ],
  ANALYSTE: [
    "PROJECT_VIEW",
    "TASK_VIEW",
    "COMMENT_CREATE",
    "REPORT_VIEW",
    "WORKSPACE_VIEW",
    "LIST_VIEW",
  ],
  MEMBRE: [
    "PROJECT_VIEW",
    "TASK_VIEW",
    "COMMENT_CREATE",
    "WORKSPACE_VIEW",
    "LIST_VIEW",
  ],
};

/** Legacy bucket keys → profile keys. */
export const LEGACY_BUCKET_TO_PROFILE: Record<string, PermissionProfileKey> = {
  CHEF: "CHEF_PROJET",
  CHEF_PROJET: "CHEF_PROJET",
  DEVELOPPEUR: "DEVELOPPEUR",
  DESIGNER: "DESIGNER",
  TESTEUR: "TESTEUR",
  ANALYSTE: "ANALYSTE",
  MEMBRE: "MEMBRE",
};

/** Legacy project slugs → UML permission names. */
export const LEGACY_SLUG_TO_UML: Record<string, string> = {
  view_project: "PROJECT_VIEW",
  view_tasks: "TASK_VIEW",
  edit_project: "PROJECT_EDIT",
  delete_project: "PROJECT_DELETE",
  manage_project_members: "TEAM_MANAGE",
  create_sprints: "SPRINT_CREATE",
  manage_sprints: "SPRINT_MANAGE",
  create_tasks: "TASK_CREATE",
  edit_all_tasks: "TASK_EDIT_ALL",
  edit_assigned_tasks: "TASK_EDIT_ASSIGNED",
  delete_tasks: "TASK_DELETE",
  assign_tasks: "TASK_ASSIGN",
  change_task_status: "TASK_STATUS_ALL",
  change_own_task_status: "TASK_STATUS_OWN",
  validate_tasks: "TASK_VALIDATE",
  view_reports: "REPORT_VIEW",
  comment_tasks: "COMMENT_CREATE",
  upload_files: "FILE_UPLOAD",
  report_bugs: "ANOMALY_REPORT",
};

/** UML → legacy slug (first match) for dual-write compatibility. */
export const UML_TO_LEGACY_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_SLUG_TO_UML).map(([slug, uml]) => [uml, slug])
);

/** Catalog aliases (existing names that satisfy UML checks). */
export const UML_ALIASES: Record<string, readonly string[]> = {
  PROJECT_VIEW: ["PROJECT_VIEW_ALL"],
  TASK_VIEW: ["TASK_VIEW_ALL"],
  TASK_EDIT_ALL: ["TASK_EDIT"],
  TEAM_MANAGE: ["TEAM_MANAGE_ROLES", "PROJECT_MANAGE_ACCESS"],
  SPRINT_MANAGE: ["SPRINT_MANAGE"],
  SPRINT_CREATE: ["SPRINT_CREATE", "SPRINT_MANAGE"],
  SPRINT_VIEW: ["SPRINT_VIEW", "SPRINT_MANAGE", "SPRINT_CREATE"],
  REPORT_VIEW: ["REPORT_VIEW", "ANALYTICS_VIEW"],
  TASK_ASSIGN: ["TASK_ASSIGN"],
  TASK_CREATE: ["TASK_CREATE"],
  TASK_DELETE: ["TASK_DELETE"],
  PROJECT_EDIT: ["PROJECT_EDIT"],
};

export const DEFAULT_VISIBLE_PROFILES: PermissionProfileKey[] = [
  "CHEF_PROJET",
  "DEVELOPPEUR",
];

export function normalizeProfileKey(raw: string | null | undefined): PermissionProfileKey | null {
  if (!raw || !String(raw).trim()) return null;
  const key = String(raw).trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (key in LEGACY_BUCKET_TO_PROFILE) {
    return LEGACY_BUCKET_TO_PROFILE[key];
  }
  if ((PROFILE_KEYS as readonly string[]).includes(key)) {
    return key as PermissionProfileKey;
  }
  return null;
}

/** Map utilisateur.poste or invitation label → profile key. */
export function posteToProfileKey(
  poste: string | null | undefined
): PermissionProfileKey {
  const label = resolveProjectPosteLabel(poste);
  switch (label) {
    case "Chef de projet":
      return "CHEF_PROJET";
    case "Développeur":
      return "DEVELOPPEUR";
    case "Designer":
      return "DESIGNER";
    case "Testeur":
      return "TESTEUR";
    case "Analyste":
      return "ANALYSTE";
    default:
      return "MEMBRE";
  }
}

export function permissionToUml(name: string): string {
  if (LEGACY_SLUG_TO_UML[name]) return LEGACY_SLUG_TO_UML[name];
  return name;
}

export function normalizePermissionList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const x of raw) {
    if (typeof x !== "string" || !x.trim()) continue;
    out.add(permissionToUml(x.trim()));
  }
  return [...out];
}

/** Expand UML permission to include catalog aliases for hasPermission checks. */
export function expandPermissionName(uml: string): string[] {
  const names = new Set<string>([uml]);
  const aliases = UML_ALIASES[uml];
  if (aliases) for (const a of aliases) names.add(a);
  const legacy = UML_TO_LEGACY_SLUG[uml];
  if (legacy) names.add(legacy);
  return [...names];
}

export function permissionSetHas(
  granted: ReadonlySet<string> | string[] | undefined | null,
  requiredUml: string
): boolean {
  if (!granted) return false;
  const set = granted instanceof Set ? granted : new Set(granted);
  for (const name of expandPermissionName(requiredUml)) {
    if (set.has(name)) return true;
  }
  return false;
}

export function isAdminAccountType(roleNom: string | null | undefined): boolean {
  const r = String(roleNom ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  return (
    r === "admin" ||
    r === "administrateur" ||
    r === "superadmin" ||
    r === "super_admin"
  );
}

export function isUtilisateurAccountType(roleNom: string | null | undefined): boolean {
  if (isAdminAccountType(roleNom)) return false;
  const r = String(roleNom ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return r === "membre" || r === "member" || r === "utilisateur" || r === "user";
}
