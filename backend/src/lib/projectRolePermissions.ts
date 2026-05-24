/**

 * Project-scoped permissions (UML + legacy slugs for backward compatibility).

 * Profiles are stored in `entreprise_project_role_config` (see enterpriseProjectRoleConfig.service).

 */



import {

  DEFAULT_PROFILE_PERMISSIONS,

  LEGACY_SLUG_TO_UML,

  PROFILE_LABELS_FR,

  type PermissionProfileKey,

} from "./permissionProfiles";



/** UML permission keys (primary — shown in admin matrix). */

export const UML_PROJECT_PERMISSION_KEYS = [

  "PROJECT_VIEW",

  "TASK_VIEW",

  "SPRINT_VIEW",

  "PROJECT_EDIT",

  "PROJECT_DELETE",

  "TEAM_MANAGE",

  "SPRINT_CREATE",

  "SPRINT_MANAGE",

  "TASK_CREATE",

  "TASK_EDIT_ALL",

  "TASK_EDIT_ASSIGNED",

  "TASK_DELETE",

  "TASK_ASSIGN",

  "TASK_STATUS_ALL",

  "TASK_STATUS_OWN",

  "TASK_VALIDATE",

  "REPORT_VIEW",

  "COMMENT_CREATE",

  "FILE_UPLOAD",

  "ANOMALY_REPORT",

] as const;



export type UmlProjectPermissionKey = (typeof UML_PROJECT_PERMISSION_KEYS)[number];



/** Legacy slugs still accepted when reading stored config. */

export const LEGACY_PROJECT_PERMISSION_KEYS = [

  "view_project",

  "view_tasks",

  "edit_project",

  "delete_project",

  "manage_project_members",

  "create_sprints",

  "manage_sprints",

  "create_tasks",

  "edit_all_tasks",

  "edit_assigned_tasks",

  "delete_tasks",

  "assign_tasks",

  "change_task_status",

  "change_own_task_status",

  "validate_tasks",

  "view_reports",

  "comment_tasks",

  "upload_files",

  "report_bugs",

] as const;



export type LegacyProjectPermissionKey =

  (typeof LEGACY_PROJECT_PERMISSION_KEYS)[number];



export const PROJECT_PERMISSION_KEYS = UML_PROJECT_PERMISSION_KEYS;



export type ProjectPermissionKey = UmlProjectPermissionKey;



/** Profile keys stored in `entreprise_project_role_config.config_json`. */

export const PROJECT_ROLE_BUCKETS = [

  "CHEF_PROJET",

  "DEVELOPPEUR",

  "DESIGNER",

  "TESTEUR",

  "ANALYSTE",

  "MEMBRE",

] as const;



export type StoredProjectRoleBucket = (typeof PROJECT_ROLE_BUCKETS)[number];



export const PROJECT_ROLE_LABELS_FR: Record<StoredProjectRoleBucket, string> = {

  CHEF_PROJET: PROFILE_LABELS_FR.CHEF_PROJET,

  DEVELOPPEUR: PROFILE_LABELS_FR.DEVELOPPEUR,

  DESIGNER: PROFILE_LABELS_FR.DESIGNER,

  TESTEUR: PROFILE_LABELS_FR.TESTEUR,

  ANALYSTE: PROFILE_LABELS_FR.ANALYSTE,

  MEMBRE: PROFILE_LABELS_FR.MEMBRE,

};



export const PROJECT_PERMISSION_LABELS_FR: Record<ProjectPermissionKey, string> = {

  PROJECT_VIEW: "Voir le projet",

  TASK_VIEW: "Voir les tâches",

  SPRINT_VIEW: "Voir les sprints",

  PROJECT_EDIT: "Modifier le projet",

  PROJECT_DELETE: "Supprimer le projet",

  TEAM_MANAGE: "Gérer l'équipe",

  SPRINT_CREATE: "Créer des sprints",

  SPRINT_MANAGE: "Gérer les sprints",

  TASK_CREATE: "Créer des tâches",

  TASK_EDIT_ALL: "Modifier toutes les tâches",

  TASK_EDIT_ASSIGNED: "Modifier les tâches assignées",

  TASK_DELETE: "Supprimer des tâches",

  TASK_ASSIGN: "Assigner des tâches",

  TASK_STATUS_ALL: "Changer le statut (toutes tâches)",

  TASK_STATUS_OWN: "Changer le statut (ses tâches)",

  TASK_VALIDATE: "Valider des tâches",

  REPORT_VIEW: "Voir les rapports",

  COMMENT_CREATE: "Commenter",

  FILE_UPLOAD: "Téléverser des fichiers",

  ANOMALY_REPORT: "Signaler des anomalies",

};



export function isValidProjectPermissionSlug(s: string): boolean {

  if ((UML_PROJECT_PERMISSION_KEYS as readonly string[]).includes(s)) return true;

  if ((LEGACY_PROJECT_PERMISSION_KEYS as readonly string[]).includes(s)) return true;

  return false;

}



const asSet = (keys: readonly string[]) => new Set<string>(keys);



function profileDefaults(key: PermissionProfileKey): ReadonlySet<string> {

  return asSet(DEFAULT_PROFILE_PERMISSIONS[key]);

}



/** Full set for SuperAdmin / tenant Admin on their enterprise projects. */

export const ALL_PROJECT_PERMISSIONS_SET: ReadonlySet<string> = new Set([

  ...UML_PROJECT_PERMISSION_KEYS,

  ...LEGACY_PROJECT_PERMISSION_KEYS,

]);



/** Map legacy bucket key from DB → current profile key. */

export function normalizeStoredProfileKey(

  raw: string

): StoredProjectRoleBucket | null {

  const k = raw.trim().toUpperCase();

  if (k === "CHEF") return "CHEF_PROJET";

  if ((PROJECT_ROLE_BUCKETS as readonly string[]).includes(k)) {

    return k as StoredProjectRoleBucket;

  }

  return null;

}



/**

 * Normalize free-text role_projet (French / casing / accents) to a profile bucket key.

 */

export function normalizeProjectRoleBucket(

  label: string | null | undefined

): StoredProjectRoleBucket | "OTHER" {

  if (!label || !String(label).trim()) return "MEMBRE";

  const n = String(label)

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "")

    .toLowerCase()

    .replace(/[_-]+/g, " ")

    .replace(/\s+/g, " ")

    .trim();



  if (n.includes("chef") && n.includes("projet")) return "CHEF_PROJET";

  if (

    (n.includes("project") && n.includes("manager")) ||

    (n.includes("gestionnaire") && n.includes("projet")) ||

    (n.includes("responsable") && n.includes("projet"))

  ) {

    return "CHEF_PROJET";

  }

  if (n.includes("developpeur") || n.includes("developer") || n.includes("dev ")) {

    return "DEVELOPPEUR";

  }

  if (n.includes("designer") || n.includes("design")) return "DESIGNER";

  if (n.includes("testeur") || n.includes("tester") || n.includes("qa")) return "TESTEUR";

  if (n.includes("analyste") || n.includes("analyst")) return "ANALYSTE";

  if (n.includes("scrum")) return "MEMBRE";

  if (n.includes("product") && n.includes("owner")) return "ANALYSTE";

  if (n === "membre" || n === "member") return "MEMBRE";



  return "OTHER";

}



export function getDefaultPermissionsForBucket(

  key: StoredProjectRoleBucket

): ReadonlySet<string> {

  return profileDefaults(key);

}



/** Rôle libre dans `membre_projet.role_projet` → ensemble de permissions par défaut (sans override entreprise). */

export function getDefaultPermissionsForProjectRole(

  roleProjetLabel: string | null | undefined

): ReadonlySet<string> {

  const bucket = normalizeProjectRoleBucket(roleProjetLabel);

  const key: StoredProjectRoleBucket =

    bucket === "OTHER" ? "MEMBRE" : bucket;

  return getDefaultPermissionsForBucket(key);

}



/** Permissions a user with TEAM_MANAGE may grant/revoke per member (Équipe page). */

export const MEMBER_MANAGEABLE_PERMISSION_KEYS: readonly ProjectPermissionKey[] = [

  "PROJECT_VIEW",

  "TASK_VIEW",

  "TASK_CREATE",

  "TASK_EDIT_ASSIGNED",

  "TASK_EDIT_ALL",

  "COMMENT_CREATE",

  "TASK_STATUS_OWN",

  "TASK_STATUS_ALL",

  "SPRINT_CREATE",

  "SPRINT_MANAGE",

  "TASK_DELETE",

] as const;



/** Convert legacy slug list to UML for API responses. */

export function slugsToUmlList(slugs: string[]): string[] {

  const out = new Set<string>();

  for (const s of slugs) {

    out.add(LEGACY_SLUG_TO_UML[s] ?? s);

  }

  return [...out];

}

