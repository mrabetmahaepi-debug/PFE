import type { Request } from "express";
import prisma from "../prisma/prismaClient";
import { loadReadableProjects } from "./spaceHierarchy";

const nowTrash = () => new Date();

export const activeTaskWhere = { deleted_at: null } as const;
export const activeSprintWhere = { deleted_at: null } as const;

export type MemberTrashItemType = "task" | "subtask" | "list" | "sprint";

export type MemberTrashItem = {
  type: MemberTrashItemType;
  id: number;
  name: string;
  deleted_at: string;
  deleted_by: number | null;
  deleted_by_name: string;
  id_projet?: number | null;
  id_sprint?: number | null;
  id_list?: number | null;
};

function displayUserName(user: {
  prenom?: string | null;
  nom?: string | null;
  email?: string | null;
} | null): string {
  if (!user) return "Utilisateur";
  const full = `${user.prenom ?? ""} ${user.nom ?? ""}`.trim();
  return full || user.email || "Utilisateur";
}

async function loadDeleterNames(
  ids: number[]
): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (!unique.length) return new Map();
  const users = await prisma.utilisateur.findMany({
    where: { id_utilisateur: { in: unique } },
    select: { id_utilisateur: true, prenom: true, nom: true, email: true },
  });
  return new Map(
    users.map((u) => [u.id_utilisateur, displayUserName(u)])
  );
}

export async function moveTaskToTrash(
  id_tache: number,
  deletedBy: number
): Promise<void> {
  const at = nowTrash();
  const data = { deleted_at: at, deleted_by: deletedBy };
  await prisma.tache.updateMany({
    where: { id_parent_tache: id_tache, deleted_at: null },
    data,
  });
  await prisma.tache.update({
    where: { id_tache },
    data,
  });
}

export async function restoreTaskFromTrash(id_tache: number): Promise<void> {
  await prisma.tache.update({
    where: { id_tache },
    data: { deleted_at: null, deleted_by: null },
  });
  await prisma.tache.updateMany({
    where: { id_parent_tache: id_tache },
    data: { deleted_at: null, deleted_by: null },
  });
}

export async function permanentDeleteTask(id_tache: number): Promise<void> {
  const row = await prisma.tache.findUnique({
    where: { id_tache },
    select: { deleted_at: true, id_parent_tache: true },
  });
  if (!row?.deleted_at) {
    throw new Error("La tâche doit être dans la corbeille avant suppression définitive");
  }
  await prisma.tache.deleteMany({
    where: { id_parent_tache: id_tache },
  });
  await prisma.tache.delete({ where: { id_tache } });
}

export async function moveSprintToTrash(
  id_sprint: number,
  deletedBy: number
): Promise<void> {
  await prisma.sprint.update({
    where: { id_sprint },
    data: { deleted_at: nowTrash(), deleted_by: deletedBy },
  });
}

export async function restoreSprintFromTrash(id_sprint: number): Promise<void> {
  await prisma.sprint.update({
    where: { id_sprint },
    data: { deleted_at: null, deleted_by: null },
  });
}

export async function permanentDeleteSprint(id_sprint: number): Promise<void> {
  const row = await prisma.sprint.findUnique({
    where: { id_sprint },
    select: { deleted_at: true },
  });
  if (!row?.deleted_at) {
    throw new Error("Le sprint doit être dans la corbeille avant suppression définitive");
  }
  await prisma.sprint.delete({ where: { id_sprint } });
}

export async function moveListToTrashWithUser(
  id_list: number,
  deletedBy: number
): Promise<void> {
  await prisma.list_pm.update({
    where: { id_list },
    data: { deleted_at: nowTrash(), deleted_by: deletedBy },
  });
}

export async function restoreListFromTrashWithUser(
  id_list: number
): Promise<void> {
  await prisma.list_pm.update({
    where: { id_list },
    data: { deleted_at: null, deleted_by: null },
  });
}

export async function loadMemberTrashItems(
  req: Request,
  user: { id?: number; id_utilisateur?: number },
  id_entreprise: number | null
): Promise<MemberTrashItem[]> {
  if (!id_entreprise) return [];

  const readable = (await loadReadableProjects(req, user, id_entreprise)).filter(
    (p: { deleted_at?: Date | string | null }) => !p.deleted_at
  );
  const projectIds = readable.map((p: { id_projet: number }) => p.id_projet);
  if (!projectIds.length) return [];

  const [tasks, lists, sprints] = await Promise.all([
    prisma.tache.findMany({
      where: {
        id_projet: { in: projectIds },
        deleted_at: { not: null },
      },
      orderBy: { deleted_at: "desc" },
      select: {
        id_tache: true,
        nom_t: true,
        deleted_at: true,
        deleted_by: true,
        id_parent_tache: true,
        id_projet: true,
        id_sprint: true,
        id_list: true,
      },
    }),
    prisma.list_pm.findMany({
      where: {
        id_projet: { in: projectIds },
        deleted_at: { not: null },
      },
      orderBy: { deleted_at: "desc" },
      select: {
        id_list: true,
        nom: true,
        deleted_at: true,
        deleted_by: true,
        id_projet: true,
        id_sprint: true,
      },
    }),
    prisma.sprint.findMany({
      where: {
        id_projet: { in: projectIds },
        deleted_at: { not: null },
      },
      orderBy: { deleted_at: "desc" },
      select: {
        id_sprint: true,
        nom_s: true,
        deleted_at: true,
        deleted_by: true,
        id_projet: true,
      },
    }),
  ]);

  const deleterIds: number[] = [];
  for (const row of [...tasks, ...lists, ...sprints]) {
    if (row.deleted_by) deleterIds.push(row.deleted_by);
  }
  const deleterNames = await loadDeleterNames(deleterIds);

  const items: MemberTrashItem[] = [];

  for (const t of tasks) {
    if (!t.deleted_at) continue;
    const isSubtask = t.id_parent_tache != null;
    items.push({
      type: isSubtask ? "subtask" : "task",
      id: t.id_tache,
      name: t.nom_t?.trim() || (isSubtask ? "Sous-tâche" : "Tâche"),
      deleted_at: t.deleted_at.toISOString(),
      deleted_by: t.deleted_by,
      deleted_by_name:
        (t.deleted_by && deleterNames.get(t.deleted_by)) || "Utilisateur",
      id_projet: t.id_projet,
      id_sprint: t.id_sprint,
      id_list: t.id_list,
    });
  }

  for (const l of lists) {
    if (!l.deleted_at) continue;
    items.push({
      type: "list",
      id: l.id_list,
      name: l.nom?.trim() || "Liste",
      deleted_at: l.deleted_at.toISOString(),
      deleted_by: l.deleted_by,
      deleted_by_name:
        (l.deleted_by && deleterNames.get(l.deleted_by)) || "Utilisateur",
      id_projet: l.id_projet,
      id_sprint: l.id_sprint,
    });
  }

  for (const s of sprints) {
    if (!s.deleted_at) continue;
    items.push({
      type: "sprint",
      id: s.id_sprint,
      name: s.nom_s?.trim() || "Sprint",
      deleted_at: s.deleted_at.toISOString(),
      deleted_by: s.deleted_by,
      deleted_by_name:
        (s.deleted_by && deleterNames.get(s.deleted_by)) || "Utilisateur",
      id_projet: s.id_projet,
      id_sprint: s.id_sprint,
    });
  }

  items.sort(
    (a, b) =>
      new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime()
  );

  return items;
}
