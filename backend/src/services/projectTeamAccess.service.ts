import prisma from "../prisma/prismaClient";
import type { AuthedUser } from "../middleware/permissions";
import {
  MEMBER_MANAGEABLE_PERMISSION_KEYS,
  PROJECT_PERMISSION_LABELS_FR,
  isValidProjectPermissionSlug,
  normalizeProjectRoleBucket,
  type ProjectPermissionKey,
} from "../lib/projectRolePermissions";
import {
  loadMemberPermissionOverrides,
  mergePermissionOverrides,
  upsertMemberPermissionOverride,
} from "../lib/memberProjectPermissionResolution";
import { resolvePermissionsForProjectRoleLabel } from "./enterpriseProjectRoleConfig.service";
import {
  getProjectPermissionContext,
  hasProjectPermission,
} from "./projectPermission.service";
import { resolveProjectPosteLabel } from "../lib/projectRoleLabels";
import { permissionSetHas } from "../lib/permissionProfiles";
import {
  buildAssignedProjectVisibilityWhere,
  isTenantAdminUser,
} from "../lib/projectAccess";
import { isSuperAdmin } from "../middleware/permissions";
import {
  clearAccessGrant,
  upsertAccessGrant,
} from "../lib/userAccessGrants";

export type ProjectEquipeMemberRow = {
  userId: number;
  prenom: string;
  nom: string;
  email: string;
  roleProjet: string;
  assignedTaskCount: number;
  permissions: Array<{ key: string; label: string; enabled: boolean }>;
  sprints: Array<{ id: number; name: string; granted: boolean }>;
  lists: Array<{ id: number; name: string; granted: boolean }>;
  tasks: Array<{ id: number; name: string; granted: boolean }>;
};

export type ProjectEquipeSnapshot = {
  projectId: number;
  projectName: string;
  members: ProjectEquipeMemberRow[];
};

function canManageProjectEquipe(ctx: Awaited<
  ReturnType<typeof getProjectPermissionContext>
>): boolean {
  if (ctx.fullAccess) return true;
  return (
    hasProjectPermission(ctx, "TEAM_MANAGE") &&
    hasProjectPermission(ctx, "PROJECT_VIEW")
  );
}

async function assertCanManageEquipe(
  user: AuthedUser & { id: number },
  projectId: number
): Promise<{ enterpriseId: number }> {
  const ctx = await getProjectPermissionContext(user, projectId);
  if (!canManageProjectEquipe(ctx)) {
    const err = new Error("Permission insuffisante pour gérer l'équipe.");
    (err as any).status = 403;
    throw err;
  }
  const projet = await prisma.projet.findUnique({
    where: { id_projet: projectId },
    select: { id_entreprise: true, deleted_at: true },
  });
  if (!projet || projet.deleted_at) {
    const err = new Error("Projet introuvable.");
    (err as any).status = 404;
    throw err;
  }
  if (projet.id_entreprise == null) {
    const err = new Error("Projet sans entreprise.");
    (err as any).status = 400;
    throw err;
  }
  return { enterpriseId: projet.id_entreprise };
}

async function resolveEffectivePermissions(
  userId: number,
  projectId: number,
  roleLabel: string,
  enterpriseId: number
): Promise<Set<string>> {
  const base = await resolvePermissionsForProjectRoleLabel(
    enterpriseId,
    roleLabel
  );
  const overrides = await loadMemberPermissionOverrides(userId, projectId);
  if (overrides.length === 0) return new Set(base);
  return mergePermissionOverrides(base, overrides);
}

export async function getProjectEquipeSnapshot(
  user: AuthedUser & { id: number },
  projectId: number
): Promise<ProjectEquipeSnapshot> {
  const { enterpriseId } = await assertCanManageEquipe(user, projectId);

  const projet = await prisma.projet.findUnique({
    where: { id_projet: projectId },
    select: {
      id_projet: true,
      nom_p: true,
      sprint: {
        where: { deleted_at: null },
        select: { id_sprint: true, nom_s: true },
        orderBy: { id_sprint: "asc" },
      },
      list_pm: {
        where: { deleted_at: null },
        select: { id_list: true, nom: true },
        orderBy: { position: "asc" },
      },
      tache: {
        where: { deleted_at: null },
        select: { id_tache: true, nom_t: true, assigne_a: true },
        orderBy: { id_tache: "desc" },
        take: 200,
      },
      membre_projet: {
        select: {
          id_utilisateur: true,
          role_projet: true,
          utilisateur: {
            select: {
              id_utilisateur: true,
              prenom: true,
              nom: true,
              email: true,
            },
          },
        },
      },
    },
  });
  if (!projet) {
    const err = new Error("Projet introuvable.");
    (err as any).status = 404;
    throw err;
  }

  const memberIds = projet.membre_projet.map((m) => m.id_utilisateur);
  const grants =
    memberIds.length > 0
      ? await prisma.utilisateur_access_grant.findMany({
          where: {
            id_utilisateur: { in: memberIds },
            id_entreprise: enterpriseId,
          },
        })
      : [];

  const isGranted = (
    uid: number,
    type: string,
    id?: number | null
  ) =>
    grants.some(
      (g) =>
        g.id_utilisateur === uid &&
        g.resource_type === type &&
        g.resource_id === id &&
        g.effect === "GRANT"
    );

  const members: ProjectEquipeMemberRow[] = [];
  for (const m of projet.membre_projet) {
    const u = m.utilisateur;
    if (!u) continue;
    const roleLabel = m.role_projet?.trim() || "Membre";
    const effective = await resolveEffectivePermissions(
      m.id_utilisateur,
      projectId,
      roleLabel,
      enterpriseId
    );

    const assignedTaskCount = projet.tache.filter(
      (t) => t.assigne_a === m.id_utilisateur
    ).length;

    const permissions = MEMBER_MANAGEABLE_PERMISSION_KEYS.map((key) => ({
      key,
      label: PROJECT_PERMISSION_LABELS_FR[key],
      enabled: effective.has(key),
    }));

    const hasBroadProjectAccess =
      permissionSetHas(effective, "TEAM_MANAGE") ||
      permissionSetHas(effective, "SPRINT_MANAGE");

    members.push({
      userId: m.id_utilisateur,
      prenom: u.prenom ?? "",
      nom: u.nom ?? "",
      email: u.email ?? "",
      roleProjet: roleLabel,
      assignedTaskCount,
      permissions,
      sprints: projet.sprint.map((s) => ({
        id: s.id_sprint,
        name: s.nom_s?.trim() || `Sprint #${s.id_sprint}`,
        granted: hasBroadProjectAccess || isGranted(m.id_utilisateur, "SPRINT", s.id_sprint),
      })),
      lists: projet.list_pm.map((l) => ({
        id: l.id_list,
        name: l.nom?.trim() || `Liste #${l.id_list}`,
        granted: hasBroadProjectAccess || isGranted(m.id_utilisateur, "LIST", l.id_list),
      })),
      tasks: projet.tache.map((t) => ({
        id: t.id_tache,
        name: t.nom_t?.trim() || `Tâche #${t.id_tache}`,
        granted:
          hasBroadProjectAccess ||
          isGranted(m.id_utilisateur, "TASK", t.id_tache) ||
          t.assigne_a === m.id_utilisateur,
      })),
    });
  }

  members.sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"));

  return {
    projectId,
    projectName: projet.nom_p?.trim() || `Projet #${projectId}`,
    members,
  };
}

export type SaveMemberEquipeInput = {
  roleProjet?: string | null;
  permissions: Array<{ key: string; enabled: boolean }>;
  sprints?: Array<{ id: number; granted: boolean }>;
  lists?: Array<{ id: number; granted: boolean }>;
  tasks?: Array<{ id: number; granted: boolean }>;
};

export async function saveProjectMemberEquipe(
  actor: AuthedUser & { id: number },
  projectId: number,
  memberUserId: number,
  input: SaveMemberEquipeInput
): Promise<void> {
  const { enterpriseId } = await assertCanManageEquipe(actor, projectId);

  const membership = await prisma.membre_projet.findFirst({
    where: { id_projet: projectId, id_utilisateur: memberUserId },
  });
  if (!membership) {
    const err = new Error("Ce membre n'appartient pas au projet.");
    (err as any).status = 404;
    throw err;
  }

  const roleLabel = resolveProjectPosteLabel(
    input.roleProjet ?? membership.role_projet ?? undefined
  );
  const bucket = normalizeProjectRoleBucket(roleLabel);
  if (bucket === "CHEF_PROJET") {
    const err = new Error(
      "Les permissions du profil Chef de projet se gèrent via le profil utilisateur."
    );
    (err as any).status = 400;
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    if (input.roleProjet != null) {
      await tx.membre_projet.update({
        where: { id_membre_projet: membership.id_membre_projet },
        data: { role_projet: roleLabel },
      });
    }

    for (const perm of input.permissions) {
      if (!isValidProjectPermissionSlug(perm.key)) continue;
      if (
        !(MEMBER_MANAGEABLE_PERMISSION_KEYS as readonly string[]).includes(
          perm.key
        )
      ) {
        continue;
      }
      await upsertMemberPermissionOverride({
        userId: memberUserId,
        enterpriseId,
        projectId,
        permission: perm.key as ProjectPermissionKey,
        enabled: perm.enabled,
        grantedById: actor.id,
        tx,
      });
    }

    for (const sprint of input.sprints ?? []) {
      if (sprint.granted) {
        await upsertAccessGrant({
          userId: memberUserId,
          enterpriseId,
          resourceType: "SPRINT",
          resourceId: sprint.id,
          effect: "GRANT",
          grantedById: actor.id,
          tx,
        });
      } else {
        await clearAccessGrant({
          userId: memberUserId,
          resourceType: "SPRINT",
          resourceId: sprint.id,
          tx,
        });
      }
    }

    for (const list of input.lists ?? []) {
      if (list.granted) {
        await upsertAccessGrant({
          userId: memberUserId,
          enterpriseId,
          resourceType: "LIST",
          resourceId: list.id,
          effect: "GRANT",
          grantedById: actor.id,
          tx,
        });
      } else {
        await clearAccessGrant({
          userId: memberUserId,
          resourceType: "LIST",
          resourceId: list.id,
          tx,
        });
      }
    }

    for (const task of input.tasks ?? []) {
      if (task.granted) {
        await upsertAccessGrant({
          userId: memberUserId,
          enterpriseId,
          resourceType: "TASK",
          resourceId: task.id,
          effect: "GRANT",
          grantedById: actor.id,
          tx,
        });
      } else {
        await clearAccessGrant({
          userId: memberUserId,
          resourceType: "TASK",
          resourceId: task.id,
          tx,
        });
      }
    }
  });
}

export async function getMyManagedProjects(
  user: AuthedUser & { id: number }
): Promise<Array<{ id: number; name: string }>> {
  const enterpriseId = user.id_entreprise ?? null;
  if (!enterpriseId) return [];

  const baseWhere = {
    id_entreprise: enterpriseId,
    deleted_at: null,
  };

  if (isSuperAdmin(user) || isTenantAdminUser(user)) {
    const rows = await prisma.projet.findMany({
      where: baseWhere,
      select: { id_projet: true, nom_p: true },
      orderBy: { nom_p: "asc" },
    });
    return rows.map((p) => ({
      id: p.id_projet,
      name: p.nom_p?.trim() || `Projet #${p.id_projet}`,
    }));
  }

  const rows = await prisma.projet.findMany({
    where: {
      ...baseWhere,
      ...buildAssignedProjectVisibilityWhere(user.id),
    },
    select: { id_projet: true, nom_p: true },
    orderBy: { nom_p: "asc" },
  });

  const managed: Array<{ id: number; name: string }> = [];
  for (const p of rows) {
    const ctx = await getProjectPermissionContext(user, p.id_projet);
    if (canManageProjectEquipe(ctx)) {
      managed.push({
        id: p.id_projet,
        name: p.nom_p?.trim() || `Projet #${p.id_projet}`,
      });
    }
  }
  return managed;
}

export type AddProjectMemberEquipeInput = {
  userId: number;
  profilePoste: string;
};

/** Add an enterprise user to the project with a non-chef permission profile. */
export async function addProjectMemberEquipe(
  actor: AuthedUser & { id: number },
  projectId: number,
  input: AddProjectMemberEquipeInput
): Promise<void> {
  const { enterpriseId } = await assertCanManageEquipe(actor, projectId);

  const memberUserId = Number(input.userId);
  if (!Number.isFinite(memberUserId) || memberUserId < 1) {
    const err = new Error("Utilisateur invalide.");
    (err as any).status = 400;
    throw err;
  }

  const roleLabel = resolveProjectPosteLabel(input.profilePoste);
  const bucket = normalizeProjectRoleBucket(roleLabel);
  if (bucket === "CHEF_PROJET") {
    const err = new Error(
      "Le profil Chef de projet ne peut pas être assigné depuis cette page."
    );
    (err as any).status = 400;
    throw err;
  }

  const assignee = await prisma.utilisateur.findUnique({
    where: { id_utilisateur: memberUserId },
    select: { id_entreprise: true },
  });
  if (!assignee || assignee.id_entreprise !== enterpriseId) {
    const err = new Error("Utilisateur introuvable dans votre entreprise.");
    (err as any).status = 404;
    throw err;
  }

  const existing = await prisma.membre_projet.findFirst({
    where: { id_projet: projectId, id_utilisateur: memberUserId },
  });
  if (existing) {
    const err = new Error("Cet utilisateur fait déjà partie de l'équipe.");
    (err as any).status = 409;
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    await tx.membre_projet.create({
      data: {
        id_projet: projectId,
        id_utilisateur: memberUserId,
        role_projet: roleLabel,
      },
    });

    await tx.utilisateur.update({
      where: { id_utilisateur: memberUserId },
      data: { poste: roleLabel },
    });

    const existingAff = await tx.affectation.findFirst({
      where: { id_projet: projectId, id_utilisateur: memberUserId },
    });
    if (!existingAff) {
      await tx.affectation.create({
        data: {
          id_projet: projectId,
          id_utilisateur: memberUserId,
          role_affectation: "membre",
        },
      });
    }
  });
}
