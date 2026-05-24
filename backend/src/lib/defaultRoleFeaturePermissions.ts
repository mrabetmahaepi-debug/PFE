import { resolveProjectPosteLabel } from "./projectRoleLabels";
import { normalizeProjectRoleBucket } from "./projectRolePermissions";

const BASE_WORKSPACE = [
  "WORKSPACE_VIEW",
  "FOLDER_VIEW",
  "LIST_VIEW",
  "TEAM_VIEW",
  "MESSAGING_USE",
] as const;

/** Default platform feature permissions seeded for new users by project poste. */
const ROLE_DEFAULT_FEATURES: Record<string, readonly string[]> = {
  CHEF: [...BASE_WORKSPACE, "TASK_VIEW_ALL", "TASK_EDIT"],
  DEVELOPPEUR: [...BASE_WORKSPACE, "TASK_VIEW_ALL", "TASK_EDIT"],
  DESIGNER: [...BASE_WORKSPACE, "TASK_VIEW_ALL", "TASK_EDIT"],
  TESTEUR: [...BASE_WORKSPACE, "TASK_VIEW_ALL"],
  ANALYSTE: [...BASE_WORKSPACE, "TASK_VIEW_ALL"],
  MEMBRE: [...BASE_WORKSPACE, "TASK_VIEW_ALL"],
  OTHER: [...BASE_WORKSPACE, "TASK_VIEW_ALL", "TASK_EDIT"],
};

export function getDefaultFeatureKeysForPoste(
  poste: string | null | undefined
): string[] {
  const label = resolveProjectPosteLabel(poste);
  const bucket = normalizeProjectRoleBucket(label);
  const key = bucket === "OTHER" ? "OTHER" : bucket;
  return [...(ROLE_DEFAULT_FEATURES[key] ?? ROLE_DEFAULT_FEATURES.MEMBRE)];
}

export function isDefaultFeatureForPoste(
  poste: string | null | undefined,
  featureKey: string
): boolean {
  return getDefaultFeatureKeysForPoste(poste).includes(featureKey);
}
