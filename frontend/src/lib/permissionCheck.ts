/** UML ↔ legacy slug aliases (mirror backend permissionProfiles.ts). */
const LEGACY_SLUG_TO_UML: Record<string, string> = {
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

const UML_ALIASES: Record<string, readonly string[]> = {
  PROJECT_VIEW: ["PROJECT_VIEW_ALL"],
  TASK_VIEW: ["TASK_VIEW_ALL"],
  TASK_EDIT_ALL: ["TASK_EDIT"],
  TEAM_MANAGE: ["TEAM_MANAGE_ROLES", "PROJECT_MANAGE_ACCESS"],
  SPRINT_MANAGE: ["SPRINT_MANAGE"],
  SPRINT_VIEW: ["SPRINT_VIEW", "SPRINT_MANAGE", "SPRINT_CREATE"],
  REPORT_VIEW: ["REPORT_VIEW", "ANALYTICS_VIEW"],
};

const UML_TO_LEGACY: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_SLUG_TO_UML).map(([slug, uml]) => [uml, slug])
);

function permissionToUml(name: string): string {
  return LEGACY_SLUG_TO_UML[name] ?? name;
}

function expandPermissionName(uml: string): string[] {
  const names = new Set<string>([uml]);
  const aliases = UML_ALIASES[uml];
  if (aliases) for (const a of aliases) names.add(a);
  const legacy = UML_TO_LEGACY[uml];
  if (legacy) names.add(legacy);
  return [...names];
}

/** Check project or global permission with UML + legacy slug support. */
export function permissionSetHas(
  granted: ReadonlySet<string> | string[] | undefined | null,
  required: string
): boolean {
  if (!granted) return false;
  const set = granted instanceof Set ? granted : new Set(granted);
  const uml = permissionToUml(required);
  for (const name of expandPermissionName(uml)) {
    if (set.has(name)) return true;
  }
  if (set.has(required)) return true;
  return false;
}
