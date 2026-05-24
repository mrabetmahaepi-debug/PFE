import type { Request } from "express";
import prisma from "../prisma/prismaClient";
import { isSuperAdmin, userHasPermission } from "../middleware/permissions";
import {
  isGlobalMembreUser,
  isTenantAdminUser,
  userCanReadProject,
  buildAssignedProjectVisibilityWhere,
} from "../lib/projectAccess";
import {
  getProjectPermissionContext,
  serializeWorkspaceProjectAuth,
} from "../services/projectPermission.service";
import {
  filterHierarchyResources,
  loadResourceGrantSets,
  shouldFilterResourcesByGrants,
} from "../lib/resourceAccessFilter";
import { filterDeveloperAssignedHierarchy } from "../lib/sidebarAccessFilter";
import { isLocalDeveloppeur } from "./projectLocalRolePermissions";
import { isProjectAccessDenied } from "../lib/userAccessGrants";
import { permissionSetHas } from "./permissionProfiles";
import { mergeActiveProjectWhere } from "./projectArchive";
import { buildProjectTasksWhere, resolveTaskProjectId } from "./projectTaskStats";

const db = prisma as any;

export const DEFAULT_SPACE_NAME = "Mon espace";

export function toInt(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export function resolveEnterpriseId(user: any): number | null {
  const fromUser = toInt(user?.id_entreprise);
  if (fromUser) return fromUser;
  const ent = user?.entreprise;
  if (ent && typeof ent === "object") return toInt(ent.id_entreprise);
  return null;
}

async function loadUserPoste(userId: number): Promise<string | null> {
  if (!Number.isFinite(userId) || userId < 1) return null;
  try {
    const row = await prisma.utilisateur.findUnique({
      where: { id_utilisateur: userId },
      select: { poste: true },
    });
    return row?.poste?.trim() || null;
  } catch (err) {
    console.warn("[spaceHierarchy] loadUserPoste failed:", err);
    return null;
  }
}

/** Ensure tenant has at least one space named "Mon espace". */
export async function ensureMonEspace(id_entreprise: number): Promise<number> {
  let space = await db.space_pm.findFirst({
    where: { id_entreprise, nom: DEFAULT_SPACE_NAME },
    select: { id_space: true },
  });
  if (space) return space.id_space;

  space = await db.space_pm.findFirst({
    where: { id_entreprise },
    orderBy: [{ position: "asc" }, { id_space: "asc" }],
    select: { id_space: true },
  });
  if (space) return space.id_space;

  const created = await db.space_pm.create({
    data: {
      nom: DEFAULT_SPACE_NAME,
      position: 0,
      id_entreprise,
    },
    select: { id_space: true },
  });
  return created.id_space;
}

/** Attach projects without space to Mon espace. */
export async function attachOrphanProjects(id_entreprise: number): Promise<void> {
  const spaceId = await ensureMonEspace(id_entreprise);
  await prisma.projet.updateMany({
    where: {
      id_entreprise,
      OR: [{ id_space: null }, { id_space: 0 }],
    },
    data: { id_space: spaceId },
  });
}

/** Same visibility rules as GET /api/projets. */
export async function buildProjectWhereClause(
  req: Request,
  user: any,
  id_entreprise: number | null
): Promise<Record<string, unknown>> {
  if (isSuperAdmin(user)) return id_entreprise ? { id_entreprise } : {};

  if (id_entreprise == null) return { id_projet: -1 };

  const userId = toInt(user?.id);
  if (!userId) return { id_projet: -1 };

  const whereClause: Record<string, unknown> = { id_entreprise };

  if (isGlobalMembreUser(user)) {
    const poste = user?.poste ?? (await loadUserPoste(userId));
    Object.assign(
      whereClause,
      buildAssignedProjectVisibilityWhere(userId, poste)
    );
  } else if (!isTenantAdminUser(user)) {
    const canViewAll = await userHasPermission(req, "PROJECT_VIEW_ALL");
    if (!canViewAll) {
      const poste = user?.poste ?? (await loadUserPoste(userId));
      Object.assign(
        whereClause,
        buildAssignedProjectVisibilityWhere(userId, poste)
      );
    }
  }

  return whereClause;
}

/** Active (non-trashed) rows only */
export const notTrashed = { deleted_at: null } as const;

export async function loadReadableProjects(
  req: Request,
  user: any,
  id_entreprise: number | null,
  options?: { includeTrashed?: boolean; includeArchived?: boolean }
) {
  const userId = toInt(user?.id);
  if (!userId) return [];

  let where = await buildProjectWhereClause(req, user, id_entreprise);
  if (!options?.includeTrashed) {
    (where as any).deleted_at = null;
  }
  where = mergeActiveProjectWhere(
    where as Record<string, unknown>,
    options?.includeArchived
  ) as typeof where;
  const rows = await prisma.projet.findMany({
    where,
    select: {
      id_projet: true,
      nom_p: true,
      description_p: true,
      statut_p: true,
      id_space: true,
      id_entreprise: true,
      deleted_at: true,
      chef_de_projet_id: true,
      membre_projet: {
        select: { id_utilisateur: true, role_projet: true },
      },
    },
    orderBy: [{ nom_p: "asc" }],
  });
  const poste = user?.poste ?? (await loadUserPoste(userId));
  const userWithPoste = { ...user, id: userId, poste };
  return rows.filter((p) => userCanReadProject(userWithPoste, p));
}

/** Filter projects denied by admin and async deny grants. */
export async function loadReadableProjectsAsync(
  req: Request,
  user: any,
  id_entreprise: number | null,
  options?: { includeTrashed?: boolean; includeArchived?: boolean }
) {
  try {
    const rows = await loadReadableProjects(req, user, id_entreprise, options);
    if (isSuperAdmin(user) || isTenantAdminUser(user)) return rows;
    const userId = toInt(user?.id);
    if (!userId) return [];
    const filtered: typeof rows = [];
    for (const p of rows) {
      try {
        if (await isProjectAccessDenied(userId, p.id_projet)) continue;
      } catch (err) {
        console.warn(
          "[spaceHierarchy] isProjectAccessDenied failed for project",
          p.id_projet,
          err
        );
      }
      filtered.push(p);
    }
    return filtered;
  } catch (err) {
    console.error("[spaceHierarchy] loadReadableProjectsAsync:", err);
    return [];
  }
}

export async function loadProjectAuth(
  user: any,
  projectId: number
): Promise<{
  currentUserProjectRole: string | null;
  currentUserPermissions: string[];
}> {
  try {
    const ctx = await getProjectPermissionContext(user, projectId);
    return serializeWorkspaceProjectAuth(user, ctx);
  } catch {
    return { currentUserProjectRole: null, currentUserPermissions: [] };
  }
}

function mapTreeTaskNode(t: any, list: any): Record<string, unknown> {
  return {
    id_tache: t.id_tache,
    nom_t: t.nom_t ?? "Tâche",
    statut_t: t.statut_t ?? null,
    id_list: t.id_list ?? list.id_list,
    id_projet: t.id_projet ?? list.id_projet,
    id_sprint: t.id_sprint ?? null,
    id_parent_tache: t.id_parent_tache ?? null,
    priorite_t: t.priorite_t ?? null,
    date_limite_t: t.date_limite_t ?? null,
  };
}

export function buildListNode(l: any, tasks: any[]) {
  const listTasks = (tasks as any[]).filter(
    (t) => Number(t.id_list) === Number(l.id_list)
  );
  const roots = listTasks.filter((t) => !t.id_parent_tache);
  const treeTasks = roots.map((root) => {
    const node = mapTreeTaskNode(root, l);
    const children = listTasks
      .filter((t) => Number(t.id_parent_tache) === Number(root.id_tache))
      .map((st) => mapTreeTaskNode(st, l));
    return children.length > 0 ? { ...node, subtasks: children } : node;
  });
  return {
    id_list: l.id_list,
    nom: l.nom ?? "Liste",
    description: l.description ?? null,
    position: l.position ?? 0,
    id_projet: l.id_projet,
    id_sprint: l.id_sprint ?? null,
    task_count: listTasks.length,
    tasks: treeTasks,
  };
}

export function buildSprintNode(s: any, listsFlat: any[], tasks: any[]) {
  const lists = (listsFlat as any[])
    .filter((l) => l.id_sprint === s.id_sprint)
    .map((l) => buildListNode(l, tasks));
  return {
    id_sprint: s.id_sprint,
    nom_s: s.nom_s ?? "Sprint",
    date_debut_s: s.date_debut_s,
    date_fin_s: s.date_fin_s,
    id_projet: s.id_projet,
    lists,
    task_count: tasks.filter(
      (t) =>
        t.id_sprint === s.id_sprint ||
        lists.some((l) => l.id_list === t.id_list)
    ).length,
  };
}

export async function buildProjectNode(
  project: any,
  sprintsFlat: any[],
  listsFlat: any[],
  tasks: any[],
  user: any
) {
  const projectId = Number(project?.id_projet);
  let auth = {
    currentUserProjectRole: null as string | null,
    currentUserPermissions: [] as string[],
  };
  let ctx: Awaited<ReturnType<typeof getProjectPermissionContext>> | null =
    null;

  try {
    auth = await loadProjectAuth(user, projectId);
    ctx = await getProjectPermissionContext(user, projectId);
  } catch (err) {
    console.warn(
      "[spaceHierarchy] buildProjectNode auth failed for project",
      projectId,
      err
    );
  }

  let projectSprintsRaw = (sprintsFlat as any[]).filter(
    (s) => Number(s.id_projet) === projectId
  );
  let projectListsRaw = (listsFlat as any[]).filter(
    (l) => Number(l.id_projet) === projectId
  );
  const projectIdByList = new Map(
    projectListsRaw.map((l) => [Number(l.id_list), projectId])
  );
  const projectIdBySprint = new Map(
    projectSprintsRaw.map((s) => [Number(s.id_sprint), projectId])
  );
  let projectTasksRaw = (tasks as any[]).filter(
    (t) =>
      resolveTaskProjectId(t, projectIdByList, projectIdBySprint) === projectId
  );

  if (ctx && user?.id) {
    const userId = Number(user.id);
    try {
      if (shouldFilterResourcesByGrants(ctx.fullAccess, ctx.roleProjet, ctx.permissions)) {
        if (isLocalDeveloppeur(ctx.roleProjet)) {
          const filtered = filterDeveloperAssignedHierarchy(
            projectSprintsRaw,
            projectListsRaw,
            projectTasksRaw,
            userId
          );
          projectSprintsRaw = filtered.sprints;
          projectListsRaw = filtered.lists;
          projectTasksRaw = filtered.tasks;
        } else {
          const grants = await loadResourceGrantSets(userId, projectId);
          if (
            grants.hasExplicitResourceGrants ||
            !permissionSetHas(ctx.permissions, "PROJECT_VIEW")
          ) {
            const filtered = filterHierarchyResources(
              projectSprintsRaw,
              projectListsRaw,
              projectTasksRaw,
              grants,
              userId
            );
            projectSprintsRaw = filtered.sprints;
            projectListsRaw = filtered.lists;
            projectTasksRaw = filtered.tasks;
          }
        }
      }
    } catch (err) {
      console.warn(
        "[spaceHierarchy] buildProjectNode access filter failed for project",
        projectId,
        err
      );
    }
  }

  const projectSprints = projectSprintsRaw.map((s) =>
    buildSprintNode(s, projectListsRaw, projectTasksRaw)
  );
  return {
    id_projet: projectId,
    nom_p: project.nom_p ?? "Projet",
    description_p: project.description_p ?? null,
    statut_p: project.statut_p ?? null,
    id_space: project.id_space ?? null,
    sprints: projectSprints,
    task_count: projectTasksRaw.length,
    hasAccessibleContent:
      projectSprints.length > 0 ||
      projectListsRaw.length > 0 ||
      projectTasksRaw.length > 0,
    ...auth,
  };
}

export async function loadHierarchyEntities(
  projectIds: number[],
  options?: { includeTrashedLists?: boolean }
) {
  if (!projectIds.length) {
    return { sprintsFlat: [], listsFlat: [], tasks: [] };
  }
  const listWhere: Record<string, unknown> = { id_projet: { in: projectIds } };
  if (!options?.includeTrashedLists) {
    listWhere.deleted_at = null;
  }
  const [sprintsFlat, listsFlat] = await Promise.all([
    db.sprint.findMany({
      where: { id_projet: { in: projectIds }, deleted_at: null },
      orderBy: [{ id_sprint: "asc" }],
    }),
    db.list_pm.findMany({
      where: listWhere,
      orderBy: [{ position: "asc" }, { id_list: "asc" }],
    }),
  ]);
  const sprintIds = (sprintsFlat as { id_sprint: number }[]).map((s) => s.id_sprint);
  const listIds = (listsFlat as { id_list: number }[]).map((l) => l.id_list);
  const tasks = await db.tache.findMany({
    where: buildProjectTasksWhere(projectIds, sprintIds, listIds),
    select: {
      id_tache: true,
      nom_t: true,
      statut_t: true,
      id_projet: true,
      id_sprint: true,
      id_list: true,
      id_parent_tache: true,
      priorite_t: true,
      date_limite_t: true,
      assigne_a: true,
    },
    orderBy: [{ id_parent_tache: "asc" }, { id_tache: "asc" }],
  });
  const activeSprintIds = new Set(
    sprintsFlat.map((s: { id_sprint: number }) => s.id_sprint)
  );
  const visibleLists = (listsFlat as { id_sprint?: number | null }[]).filter(
    (l) => !l.id_sprint || activeSprintIds.has(l.id_sprint)
  );
  return { sprintsFlat, listsFlat: visibleLists, tasks };
}

/** ClickUp-style folder = projet scoped to a space. */
export async function createFolderInSpace(
  spaceId: number,
  name: string,
  user: { id?: number; id_utilisateur?: number; id_entreprise?: number | null }
) {
  const id_entreprise = resolveEnterpriseId(user);
  if (!id_entreprise) throw new Error("ENTERPRISE_REQUIRED");

  const space = await db.space_pm.findFirst({
    where: { id_space: spaceId, id_entreprise },
    select: { id_space: true },
  });
  if (!space) throw new Error("SPACE_NOT_FOUND");

  const chefId = toInt(user.id ?? user.id_utilisateur);
  if (!chefId) throw new Error("USER_REQUIRED");

  const now = new Date();
  const projet = await prisma.projet.create({
    data: {
      nom_p: name,
      id_entreprise,
      id_space: spaceId,
      chef_de_projet_id: chefId,
      statut_p: "PLANNING",
      date_debut: now,
      date_fin: now,
    },
  });

  const existingMember = await prisma.membre_projet.findFirst({
    where: { id_projet: projet.id_projet, id_utilisateur: chefId },
    select: { id_membre_projet: true },
  });
  if (!existingMember) {
    await prisma.membre_projet.create({
      data: {
        id_projet: projet.id_projet,
        id_utilisateur: chefId,
        role_projet: "Chef de projet",
      },
    });
  }

  return {
    folderId: projet.id_projet,
    id_folder: projet.id_projet,
    id_projet: projet.id_projet,
    spaceId,
    name: projet.nom_p,
  };
}

async function ensureSprintForProject(id_projet: number) {
  let sprint = await prisma.sprint.findFirst({
    where: { id_projet },
    orderBy: { id_sprint: "asc" },
  });
  if (sprint) return sprint;

  const now = new Date();
  const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  sprint = await prisma.sprint.create({
    data: {
      nom_s: "Sprint 1",
      date_debut_s: now,
      date_fin_s: end,
      id_projet,
    },
  });
  return sprint;
}

/** ClickUp-style list under a space; folderId = id_projet (nullable). */
export async function createListInSpace(
  spaceId: number,
  folderId: number | null,
  name: string,
  user: { id_entreprise?: number | null }
) {
  const id_entreprise = resolveEnterpriseId(user);
  if (!id_entreprise) throw new Error("ENTERPRISE_REQUIRED");

  const space = await db.space_pm.findFirst({
    where: { id_space: spaceId, id_entreprise },
    select: { id_space: true },
  });
  if (!space) throw new Error("SPACE_NOT_FOUND");

  let id_projet = folderId;
  if (!id_projet) {
    const first = await prisma.projet.findFirst({
      where: { id_space: spaceId, id_entreprise, deleted_at: null },
      orderBy: { id_projet: "asc" },
      select: { id_projet: true },
    });
    if (!first) throw new Error("FOLDER_REQUIRED");
    id_projet = first.id_projet;
  }

  const project = await prisma.projet.findFirst({
    where: { id_projet, id_space: spaceId },
    select: { id_projet: true },
  });
  if (!project) throw new Error("FOLDER_NOT_IN_SPACE");

  const sprint = await ensureSprintForProject(id_projet);
  const list = await db.list_pm.create({
    data: {
      nom: name,
      id_projet,
      id_sprint: sprint.id_sprint,
      position: 0,
    },
  });

  return {
    ...list,
    folderId: id_projet,
    spaceId,
    name: list.nom,
  };
}

const nowTrash = () => new Date();

export async function moveSpaceToTrash(id_space: number) {
  const at = nowTrash();
  await db.space_pm.update({ where: { id_space }, data: { deleted_at: at } });
  const projectIds = (
    await prisma.projet.findMany({
      where: { id_space },
      select: { id_projet: true },
    })
  ).map((p) => p.id_projet);
  if (projectIds.length) {
    await prisma.projet.updateMany({
      where: { id_projet: { in: projectIds } },
      data: { deleted_at: at },
    });
    await db.list_pm.updateMany({
      where: { id_projet: { in: projectIds } },
      data: { deleted_at: at },
    });
  }
}

export async function restoreSpaceFromTrash(id_space: number) {
  await db.space_pm.update({ where: { id_space }, data: { deleted_at: null } });
}

export async function moveProjectToTrash(id_projet: number) {
  const at = nowTrash();
  await prisma.projet.update({
    where: { id_projet },
    data: { deleted_at: at },
  });
  await db.list_pm.updateMany({
    where: { id_projet },
    data: { deleted_at: at },
  });
}

export async function restoreProjectFromTrash(id_projet: number) {
  await prisma.projet.update({
    where: { id_projet },
    data: { deleted_at: null },
  });
}

export async function moveListToTrash(
  id_list: number,
  deletedBy?: number | null
) {
  await db.list_pm.update({
    where: { id_list },
    data: {
      deleted_at: nowTrash(),
      deleted_by: deletedBy ?? null,
    },
  });
}

export async function restoreListFromTrash(id_list: number) {
  await db.list_pm.update({
    where: { id_list },
    data: { deleted_at: null, deleted_by: null },
  });
}

export type TrashItem = {
  type: "space" | "project" | "list";
  id: number;
  name: string;
  deleted_at: string;
  spaceId?: number | null;
  folderId?: number | null;
};

export async function loadTrashItems(
  req: Request,
  user: any,
  id_entreprise: number | null
): Promise<TrashItem[]> {
  if (!id_entreprise) return [];
  const items: TrashItem[] = [];

  const spaces = await db.space_pm.findMany({
    where: { id_entreprise, deleted_at: { not: null } },
    orderBy: { deleted_at: "desc" },
  });
  for (const s of spaces) {
    items.push({
      type: "space",
      id: s.id_space,
      name: s.nom,
      deleted_at: s.deleted_at.toISOString(),
      spaceId: s.id_space,
    });
  }

  const readable = await loadReadableProjects(req, user, id_entreprise, {
    includeTrashed: true,
  });
  const trashedProjects = readable.filter((p: any) => p.deleted_at != null);
  for (const p of trashedProjects) {
    const deletedAt = p.deleted_at;
    if (!deletedAt) continue;
    items.push({
      type: "project",
      id: p.id_projet,
      name: p.nom_p ?? "Dossier",
      deleted_at: new Date(deletedAt).toISOString(),
      spaceId: p.id_space,
      folderId: p.id_projet,
    });
  }

  const projectIds = readable.map((p) => p.id_projet);
  if (projectIds.length) {
    const lists = await db.list_pm.findMany({
      where: { id_projet: { in: projectIds }, deleted_at: { not: null } },
      orderBy: { deleted_at: "desc" },
    });
    for (const l of lists) {
      if (!l.deleted_at) continue;
      const proj = readable.find((p) => p.id_projet === l.id_projet);
      if (proj?.deleted_at) continue;
      items.push({
        type: "list",
        id: l.id_list,
        name: l.nom,
        deleted_at: l.deleted_at.toISOString(),
        spaceId: proj?.id_space ?? null,
        folderId: l.id_projet,
      });
    }
  }

  return items;
}
