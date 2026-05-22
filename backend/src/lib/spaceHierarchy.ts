import type { Request } from "express";
import prisma from "../prisma/prismaClient";
import { isSuperAdmin, userHasPermission } from "../middleware/permissions";
import {
  isGlobalMembreUser,
  isTenantAdminUser,
  userCanReadProject,
} from "../lib/projectAccess";
import {
  getProjectPermissionContext,
  serializeWorkspaceProjectAuth,
} from "../services/projectPermission.service";

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

  const whereClause: Record<string, unknown> = { id_entreprise };

  if (isGlobalMembreUser(user)) {
    whereClause.membre_projet = { some: { id_utilisateur: user.id } };
  } else if (!isTenantAdminUser(user)) {
    const canViewAll = await userHasPermission(req, "PROJECT_VIEW_ALL");
    if (!canViewAll) {
      whereClause.membre_projet = { some: { id_utilisateur: user.id } };
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
  options?: { includeTrashed?: boolean }
) {
  const where = await buildProjectWhereClause(req, user, id_entreprise);
  if (!options?.includeTrashed) {
    (where as any).deleted_at = null;
  }
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
      membre_projet: { select: { id_utilisateur: true } },
    },
    orderBy: [{ nom_p: "asc" }],
  });
  return rows.filter((p) => userCanReadProject(user, p));
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

export function buildListNode(l: any, tasks: any[]) {
  const listTasks = (tasks as any[]).filter(
    (t) => Number(t.id_list) === Number(l.id_list)
  );
  return {
    id_list: l.id_list,
    nom: l.nom ?? "Liste",
    description: l.description ?? null,
    position: l.position ?? 0,
    id_projet: l.id_projet,
    id_sprint: l.id_sprint ?? null,
    task_count: listTasks.length,
    tasks: listTasks.map((t) => ({
      id_tache: t.id_tache,
      nom_t: t.nom_t ?? "Tâche",
      statut_t: t.statut_t ?? null,
      id_list: t.id_list ?? l.id_list,
      id_projet: t.id_projet ?? l.id_projet,
      id_sprint: t.id_sprint ?? null,
      priorite_t: t.priorite_t ?? null,
      date_limite_t: t.date_limite_t ?? null,
    })),
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
  const auth = await loadProjectAuth(user, project.id_projet);
  const projectSprints = (sprintsFlat as any[])
    .filter((s) => s.id_projet === project.id_projet)
    .map((s) => buildSprintNode(s, listsFlat, tasks));
  return {
    id_projet: project.id_projet,
    nom_p: project.nom_p ?? "Projet",
    description_p: project.description_p,
    statut_p: project.statut_p,
    id_space: project.id_space,
    sprints: projectSprints,
    task_count: tasks.filter((t) => t.id_projet === project.id_projet).length,
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
  const [sprintsFlat, listsFlat, tasks] = await Promise.all([
    prisma.sprint.findMany({
      where: { id_projet: { in: projectIds } },
      orderBy: [{ id_sprint: "asc" }],
    }),
    db.list_pm.findMany({
      where: listWhere,
      orderBy: [{ position: "asc" }, { id_list: "asc" }],
    }),
    prisma.tache.findMany({
      where: { id_projet: { in: projectIds } },
      select: {
        id_tache: true,
        nom_t: true,
        statut_t: true,
        id_projet: true,
        id_sprint: true,
        id_list: true,
        priorite_t: true,
        date_limite_t: true,
        assigne_a: true,
      },
      orderBy: [{ id_tache: "asc" }],
    }),
  ]);
  return { sprintsFlat, listsFlat, tasks };
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
        role_projet: "Chef de Projet",
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

export async function moveListToTrash(id_list: number) {
  await db.list_pm.update({
    where: { id_list },
    data: { deleted_at: nowTrash() },
  });
}

export async function restoreListFromTrash(id_list: number) {
  await db.list_pm.update({
    where: { id_list },
    data: { deleted_at: null },
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
