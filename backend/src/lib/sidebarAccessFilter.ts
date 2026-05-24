import {
  isChefDeProjetMemberRole,
  normalizeProjectLocalRole,
} from "./projectRoleLabels";
import { isLocalDeveloppeur } from "./projectLocalRolePermissions";
import { permissionSetHas } from "./permissionProfiles";
import type { ProjectPermissionContext } from "../services/projectPermission.service";
import prisma from "../prisma/prismaClient";

export type SidebarTaskRow = {
  id_tache: number;
  id_list?: number | null;
  id_sprint?: number | null;
  id_projet?: number | null;
  assigne_a?: number | null;
  id_parent_tache?: number | null;
};

/** Développeur / membre restreint : uniquement les tâches assignées (+ sous-tâches liées). */
export function filterDeveloperAssignedHierarchy<T extends SidebarTaskRow>(
  sprints: { id_sprint: number }[],
  lists: { id_list: number; id_sprint?: number | null }[],
  tasks: T[],
  userId: number
): { sprints: typeof sprints; lists: typeof lists; tasks: T[] } {
  const visibleTaskIds = new Set<number>();
  for (const t of tasks) {
    if (t.assigne_a != null && Number(t.assigne_a) === userId) {
      visibleTaskIds.add(t.id_tache);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const t of tasks) {
      if (
        t.id_parent_tache &&
        visibleTaskIds.has(Number(t.id_parent_tache)) &&
        !visibleTaskIds.has(t.id_tache)
      ) {
        visibleTaskIds.add(t.id_tache);
        changed = true;
      }
    }
  }

  const visibleListIds = new Set<number>();
  for (const t of tasks) {
    if (t.id_list && visibleTaskIds.has(t.id_tache)) {
      visibleListIds.add(Number(t.id_list));
    }
  }

  const visibleSprintIds = new Set<number>();
  for (const l of lists) {
    if (visibleListIds.has(l.id_list) && l.id_sprint) {
      visibleSprintIds.add(Number(l.id_sprint));
    }
  }

  return {
    sprints: sprints.filter((s) => visibleSprintIds.has(s.id_sprint)),
    lists: lists.filter((l) => visibleListIds.has(l.id_list)),
    tasks: tasks.filter((t) => visibleTaskIds.has(t.id_tache)),
  };
}

export function isSidebarChefOnProject(
  project: {
    id_projet: number;
    chef_de_projet_id?: number | null;
    membre_projet?: { id_utilisateur: number; role_projet?: string | null }[];
  },
  userId: number
): boolean {
  if (Number(project.chef_de_projet_id) === userId) return true;
  const member = (project.membre_projet ?? []).find(
    (m) => Number(m.id_utilisateur) === userId
  );
  return isChefDeProjetMemberRole(member?.role_projet ?? null);
}

export function resolveMemberLocalRole(
  project: {
    chef_de_projet_id?: number | null;
    membre_projet?: { id_utilisateur: number; role_projet?: string | null }[];
  },
  userId: number
): string | null {
  const member = (project.membre_projet ?? []).find(
    (m) => Number(m.id_utilisateur) === userId
  );
  if (member?.role_projet?.trim()) {
    return normalizeProjectLocalRole(member.role_projet);
  }
  if (Number(project.chef_de_projet_id) === userId) {
    return "Chef de projet";
  }
  return null;
}

/** Projets visibles dans la sidebar avant construction de l'arbre. */
export function filterReadableProjectsForSidebar<
  T extends {
    id_projet: number;
    chef_de_projet_id?: number | null;
    membre_projet?: { id_utilisateur: number; role_projet?: string | null }[];
  },
>(user: { id: number }, projects: T[], allTasks: SidebarTaskRow[]): T[] {
  const userId = Number(user.id);
  if (!Number.isFinite(userId) || userId < 1) return [];

  return projects.filter((p) => {
    const role = resolveMemberLocalRole(p, userId);
    const isMember = (p.membre_projet ?? []).some(
      (m) => Number(m.id_utilisateur) === userId
    );

    if (isChefDeProjetMemberRole(role)) {
      return isSidebarChefOnProject(p, userId);
    }

    if (isLocalDeveloppeur(role) || (isMember && role === "Développeur")) {
      const hasAssigned = allTasks.some(
        (t) =>
          Number(t.id_projet) === Number(p.id_projet) &&
          t.assigne_a != null &&
          Number(t.assigne_a) === userId
      );
      return isMember || hasAssigned;
    }

    return isMember;
  });
}

export function shouldHideEmptyProjectInSidebar(
  ctx: Pick<ProjectPermissionContext, "roleProjet" | "fullAccess"> | null
): boolean {
  if (!ctx || ctx.fullAccess) return false;
  if (isChefDeProjetMemberRole(ctx.roleProjet)) return false;
  return isLocalDeveloppeur(ctx.roleProjet);
}

/** Lecture d'une tâche selon le rôle local du projet. */
export function userCanViewTaskInProject(
  ctx: Pick<
    ProjectPermissionContext,
    "fullAccess" | "roleProjet" | "permissions"
  >,
  task: { assigne_a?: number | null },
  userId: number
): boolean {
  if (ctx.fullAccess) return true;
  if (isChefDeProjetMemberRole(ctx.roleProjet)) return true;
  if (isLocalDeveloppeur(ctx.roleProjet)) {
    return task.assigne_a != null && Number(task.assigne_a) === userId;
  }
  if (
    permissionSetHas(ctx.permissions, "TASK_EDIT_ALL") ||
    permissionSetHas(ctx.permissions, "TASK_STATUS_ALL")
  ) {
    return true;
  }
  if (task.assigne_a != null && Number(task.assigne_a) === userId) {
    return true;
  }
  return false;
}

/** Liste accessible si le membre peut lire le projet ou y a des tâches assignées (développeur). */
export async function userCanAccessListInProject(
  userId: number,
  ctx: Pick<ProjectPermissionContext, "fullAccess" | "roleProjet">,
  listId: number
): Promise<boolean> {
  if (ctx.fullAccess || isChefDeProjetMemberRole(ctx.roleProjet)) return true;
  if (!isLocalDeveloppeur(ctx.roleProjet)) return true;
  const uid = Number(userId);
  const lid = Number(listId);
  if (!Number.isFinite(uid) || uid < 1 || !Number.isFinite(lid) || lid < 1) {
    return false;
  }
  const count = await prisma.tache.count({
    where: { id_list: lid, assigne_a: uid, deleted_at: null },
  });
  return count > 0;
}

export function filterTasksForProjectContext<
  T extends { assigne_a?: number | null },
>(
  ctx: Pick<
    ProjectPermissionContext,
    "fullAccess" | "roleProjet" | "permissions"
  >,
  tasks: T[],
  userId: number
): T[] {
  return tasks.filter((t) => userCanViewTaskInProject(ctx, t, userId));
}
