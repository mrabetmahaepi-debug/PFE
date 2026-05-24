import prisma from "../prisma/prismaClient";
import {
  normalizeProjectRoleBucket,
  type StoredProjectRoleBucket,
} from "./projectRolePermissions";
import { isMissingAccessGrantsTable } from "./accessGrantsTable";
import { isLocalDeveloppeur } from "./projectLocalRolePermissions";
import { permissionSetHas } from "./permissionProfiles";

export type ResourceGrantSets = {
  sprintIds: Set<number>;
  listIds: Set<number>;
  taskIds: Set<number>;
  /** True when at least one explicit SPRINT/LIST/TASK grant exists for this project. */
  hasExplicitResourceGrants: boolean;
};

export async function loadResourceGrantSets(
  userId: number,
  projectId: number
): Promise<ResourceGrantSets> {
  const empty: ResourceGrantSets = {
    sprintIds: new Set(),
    listIds: new Set(),
    taskIds: new Set(),
    hasExplicitResourceGrants: false,
  };
  if (!Number.isFinite(userId) || userId < 1) return empty;
  if (!Number.isFinite(projectId) || projectId < 1) return empty;

  let rows: Array<{ resource_type: string; resource_id: number | null }>;
  try {
    rows = await prisma.utilisateur_access_grant.findMany({
      where: {
        id_utilisateur: userId,
        resource_type: { in: ["SPRINT", "LIST", "TASK"] },
        effect: "GRANT",
        resource_id: { not: null },
      },
      select: { resource_type: true, resource_id: true },
    });
  } catch (err) {
    if (isMissingAccessGrantsTable(err)) return empty;
    throw err;
  }

  const sprintIds = new Set<number>();
  const listIds = new Set<number>();
  const taskIds = new Set<number>();

  for (const row of rows) {
    const id = row.resource_id;
    if (id == null || !Number.isFinite(id)) continue;
    if (row.resource_type === "SPRINT") sprintIds.add(id);
    else if (row.resource_type === "LIST") listIds.add(id);
    else if (row.resource_type === "TASK") taskIds.add(id);
  }

  // Scope to project entities
  if (sprintIds.size > 0) {
    const valid = await prisma.sprint.findMany({
      where: { id_projet: projectId, id_sprint: { in: [...sprintIds] } },
      select: { id_sprint: true },
    });
    sprintIds.clear();
    for (const s of valid) sprintIds.add(s.id_sprint);
  }
  if (listIds.size > 0) {
    const valid = await (prisma as any).list_pm.findMany({
      where: { id_projet: projectId, id_list: { in: [...listIds] } },
      select: { id_list: true },
    });
    listIds.clear();
    for (const l of valid) listIds.add(l.id_list);
  }
  if (taskIds.size > 0) {
    const valid = await prisma.tache.findMany({
      where: { id_projet: projectId, id_tache: { in: [...taskIds] } },
      select: { id_tache: true },
    });
    taskIds.clear();
    for (const t of valid) taskIds.add(t.id_tache);
  }

  return {
    sprintIds,
    listIds,
    taskIds,
    hasExplicitResourceGrants:
      sprintIds.size > 0 || listIds.size > 0 || taskIds.size > 0,
  };
}

export function shouldFilterResourcesByGrants(
  fullAccess: boolean,
  roleProjet: string | null,
  permissions?: ReadonlySet<string>
): boolean {
  if (fullAccess) return false;
  if (isLocalDeveloppeur(roleProjet)) return true;

  if (permissions && permissions.size > 0) {
    if (permissionSetHas(permissions, "TASK_EDIT_ALL")) return false;
    if (permissionSetHas(permissions, "TEAM_MANAGE")) return false;
    if (
      permissionSetHas(permissions, "PROJECT_VIEW") &&
      permissionSetHas(permissions, "TASK_VIEW") &&
      (permissionSetHas(permissions, "SPRINT_VIEW") ||
        permissionSetHas(permissions, "SPRINT_MANAGE") ||
        permissionSetHas(permissions, "SPRINT_CREATE"))
    ) {
      return false;
    }
    return true;
  }

  const bucket = normalizeProjectRoleBucket(roleProjet);
  if (bucket === "CHEF_PROJET") return false;
  return true;
}

type TaskRow = {
  id_tache: number;
  id_list?: number | null;
  id_sprint?: number | null;
  id_projet?: number | null;
  assigne_a?: number | null;
  id_parent_tache?: number | null;
};

/**
 * Filter sprint/list/task rows for members whose access is scoped by grants.
 * Tasks assigned to the user remain visible even without explicit TASK grant.
 */
export function filterHierarchyResources<T extends TaskRow>(
  sprints: { id_sprint: number }[],
  lists: { id_list: number; id_sprint?: number | null }[],
  tasks: T[],
  grants: ResourceGrantSets,
  userId: number
): { sprints: typeof sprints; lists: typeof lists; tasks: T[] } {
  const visibleTaskIds = new Set<number>();
  for (const t of tasks) {
    const assigned =
      t.assigne_a != null && Number(t.assigne_a) === userId;
    const granted = grants.taskIds.has(t.id_tache);
    if (granted || assigned) visibleTaskIds.add(t.id_tache);
  }

  // Subtasks follow parent visibility
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of tasks) {
      if (t.id_parent_tache && visibleTaskIds.has(t.id_parent_tache)) {
        if (!visibleTaskIds.has(t.id_tache)) {
          visibleTaskIds.add(t.id_tache);
          changed = true;
        }
      }
    }
  }

  const visibleListIds = new Set<number>();
  for (const l of lists) {
    if (grants.listIds.has(l.id_list)) visibleListIds.add(l.id_list);
  }
  for (const t of tasks) {
    if (t.id_list && visibleTaskIds.has(t.id_tache)) {
      visibleListIds.add(t.id_list);
    }
  }

  const visibleSprintIds = new Set<number>();
  for (const s of sprints) {
    if (grants.sprintIds.has(s.id_sprint)) visibleSprintIds.add(s.id_sprint);
  }
  for (const l of lists) {
    if (l.id_sprint && visibleListIds.has(l.id_list)) {
      visibleSprintIds.add(l.id_sprint);
    }
  }

  const filteredTasks = tasks.filter((t) => visibleTaskIds.has(t.id_tache));
  const filteredLists = lists.filter((l) => visibleListIds.has(l.id_list));
  const filteredSprints = sprints.filter((s) =>
    visibleSprintIds.has(s.id_sprint)
  );

  return {
    sprints: filteredSprints,
    lists: filteredLists,
    tasks: filteredTasks,
  };
}

export function hasAccessibleWorkspaceContent(
  sprints: unknown[],
  lists: unknown[],
  tasks: unknown[]
): boolean {
  return sprints.length > 0 || lists.length > 0 || tasks.length > 0;
}
