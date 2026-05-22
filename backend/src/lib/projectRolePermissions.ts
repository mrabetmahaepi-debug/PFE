/**
 * Project-scoped permissions (not global User.role).
 * Keys are stable English slugs for API / middleware.
 * Enterprise overrides: `entreprise_project_role_config` (see enterpriseProjectRoleConfig.service).
 */

export const PROJECT_PERMISSION_KEYS = [
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

export type ProjectPermissionKey = (typeof PROJECT_PERMISSION_KEYS)[number];

/** Keys stored in `entreprise_project_role_config.config_json` (one column per rôle projet). */
export const PROJECT_ROLE_BUCKETS = [
  "CHEF",
  "DEVELOPPEUR",
  "DESIGNER",
  "TESTEUR",
  "ANALYSTE",
  "MEMBRE",
] as const;

export type StoredProjectRoleBucket = (typeof PROJECT_ROLE_BUCKETS)[number];

export const PROJECT_ROLE_LABELS_FR: Record<StoredProjectRoleBucket, string> = {
  CHEF: "Chef de Projet",
  DEVELOPPEUR: "Développeur",
  DESIGNER: "Designer",
  TESTEUR: "Testeur",
  ANALYSTE: "Analyste",
  MEMBRE: "Membre",
};

export const PROJECT_PERMISSION_LABELS_FR: Record<ProjectPermissionKey, string> = {
  view_project: "Voir le projet",
  view_tasks: "Voir les tâches",
  edit_project: "Modifier le projet",
  delete_project: "Supprimer le projet",
  manage_project_members: "Gérer les membres du projet",
  create_sprints: "Créer des sprints",
  manage_sprints: "Gérer les sprints",
  create_tasks: "Créer des tâches",
  edit_all_tasks: "Modifier toutes les tâches",
  edit_assigned_tasks: "Modifier les tâches assignées",
  delete_tasks: "Supprimer des tâches",
  assign_tasks: "Assigner des tâches",
  change_task_status: "Changer le statut (toutes tâches)",
  change_own_task_status: "Changer le statut (ses tâches)",
  validate_tasks: "Valider des tâches",
  view_reports: "Voir les rapports",
  comment_tasks: "Commenter",
  upload_files: "Téléverser des fichiers",
  report_bugs: "Signaler des anomalies",
};

export function isValidProjectPermissionSlug(s: string): s is ProjectPermissionKey {
  return (PROJECT_PERMISSION_KEYS as readonly string[]).includes(s);
}

const asSet = (keys: ProjectPermissionKey[]) => new Set<string>(keys);

/** Chef de projet — peut modifier et supprimer son projet. */
const CHEF_DE_PROJET = asSet([
  "view_project",
  "view_tasks",
  "edit_project",
  "delete_project",
  "manage_project_members",
  "create_sprints",
  "manage_sprints",
  "create_tasks",
  "edit_all_tasks",
  "delete_tasks",
  "assign_tasks",
  "change_task_status",
  "validate_tasks",
  "view_reports",
  "comment_tasks",
  "upload_files",
]);

const DEVELOPPEUR = asSet([
  "view_project",
  "view_tasks",
  "edit_assigned_tasks",
  "change_own_task_status",
  "comment_tasks",
  "upload_files",
]);

const DESIGNER = new Set<string>(DEVELOPPEUR);

const TESTEUR = asSet([
  "view_project",
  "view_tasks",
  "change_own_task_status",
  "validate_tasks",
  "comment_tasks",
  "report_bugs",
]);

const ANALYSTE = asSet([
  "view_project",
  "view_tasks",
  "comment_tasks",
  "view_reports",
]);

const MEMBRE = asSet([
  "view_project",
  "view_tasks",
  "comment_tasks",
]);

/** Full set for SuperAdmin / tenant Admin on their enterprise projects. */
export const ALL_PROJECT_PERMISSIONS_SET: ReadonlySet<string> = new Set([
  ...CHEF_DE_PROJET,
  ...DEVELOPPEUR,
  ...TESTEUR,
  ...ANALYSTE,
  ...MEMBRE,
]);

/**
 * Normalize free-text role_projet (French / casing / accents) to a bucket key.
 */
export function normalizeProjectRoleBucket(
  label: string | null | undefined
): "CHEF" | "DEVELOPPEUR" | "DESIGNER" | "TESTEUR" | "ANALYSTE" | "MEMBRE" | "OTHER" {
  if (!label || !String(label).trim()) return "MEMBRE";
  const n = String(label)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (n.includes("chef") && n.includes("projet")) return "CHEF";
  if (n.includes("developpeur") || n.includes("developer") || n.includes("dev ")) return "DEVELOPPEUR";
  if (n.includes("designer") || n.includes("design")) return "DESIGNER";
  if (n.includes("testeur") || n.includes("tester") || n.includes("qa")) return "TESTEUR";
  if (n.includes("analyste") || n.includes("analyst")) return "ANALYSTE";
  if (n === "membre" || n === "member") return "MEMBRE";

  return "OTHER";
}

export function getDefaultPermissionsForBucket(
  key: StoredProjectRoleBucket
): ReadonlySet<string> {
  switch (key) {
    case "CHEF":
      return CHEF_DE_PROJET;
    case "DEVELOPPEUR":
      return DEVELOPPEUR;
    case "DESIGNER":
      return DESIGNER;
    case "TESTEUR":
      return TESTEUR;
    case "ANALYSTE":
      return ANALYSTE;
    case "MEMBRE":
      return MEMBRE;
    default: {
      const _x: never = key;
      return _x;
    }
  }
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
