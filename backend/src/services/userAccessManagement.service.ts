import prisma from "../prisma/prismaClient";
import { isDefaultFeatureForPoste } from "../lib/defaultRoleFeaturePermissions";
import { PERMISSIONS } from "../modules/permissions/permissions.catalog";
import { resolveProjectPosteLabel } from "../lib/projectRoleLabels";
import {
  clearAccessGrant,
  removeMembreProjetAccess,
  upsertAccessGrant,
  upsertMembreProjetAccess,
  type AccessResourceType,
} from "../lib/userAccessGrants";

export type UserAccessProjectRow = {
  id: number;
  name: string;
  hasAccess: boolean;
  denied: boolean;
  roleProjet: string | null;
  sprints: Array<{ id: number; name: string; granted: boolean }>;
  lists: Array<{ id: number; name: string; granted: boolean }>;
  tasks: Array<{ id: number; name: string; granted: boolean }>;
};

export type UserAccessFeatureRow = {
  key: string;
  label: string;
  granted: boolean;
  denied: boolean;
};

export type UserAccessSnapshot = {
  userId: number;
  poste: string | null;
  projects: UserAccessProjectRow[];
  features: UserAccessFeatureRow[];
};

export type SaveUserAccessInput = {
  userId: number;
  enterpriseId: number;
  grantedById: number;
  projects: Array<{
    projectId: number;
    enabled: boolean;
    roleProjet?: string | null;
    sprints?: Array<{ id: number; granted: boolean }>;
    lists?: Array<{ id: number; granted: boolean }>;
    tasks?: Array<{ id: number; granted: boolean }>;
  }>;
  features?: Array<{ key: string; granted: boolean }>;
};

const MEMBER_FEATURE_KEYS = [
  "WORKSPACE_VIEW",
  "FOLDER_VIEW",
  "LIST_VIEW",
  "TASK_VIEW_ALL",
  "TASK_EDIT",
  "TEAM_VIEW",
  "MESSAGING_USE",
] as const;

function grantKey(
  resourceType: AccessResourceType,
  resourceId?: number | null,
  featureKey?: string | null
): string {
  return `${resourceType}:${resourceId ?? ""}:${featureKey ?? ""}`;
}

export async function getUserAccessSnapshot(
  userId: number,
  enterpriseId: number
): Promise<UserAccessSnapshot | null> {
  const user = await prisma.utilisateur.findFirst({
    where: { id_utilisateur: userId, id_entreprise: enterpriseId },
    select: { id_utilisateur: true, poste: true },
  });
  if (!user) return null;

  const [projects, memberships, grants] = await Promise.all([
    prisma.projet.findMany({
      where: { id_entreprise: enterpriseId, deleted_at: null },
      select: {
        id_projet: true,
        nom_p: true,
        sprint: {
          where: { deleted_at: null },
          select: { id_sprint: true, nom_s: true },
          take: 50,
        },
        list_pm: {
          where: { deleted_at: null },
          select: { id_list: true, nom: true },
          take: 80,
        },
        tache: {
          where: { deleted_at: null },
          select: { id_tache: true, nom_t: true },
          take: 80,
          orderBy: { id_tache: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.membre_projet.findMany({
      where: { id_utilisateur: userId },
      select: { id_projet: true, role_projet: true },
    }),
    prisma.utilisateur_access_grant.findMany({
      where: { id_utilisateur: userId, id_entreprise: enterpriseId },
    }).catch(() => [] as Awaited<
      ReturnType<typeof prisma.utilisateur_access_grant.findMany>
    >),
  ]);

  const membershipByProject = new Map(
    memberships.map((m) => [m.id_projet, m.role_projet ?? null])
  );

  const grantMap = new Map<string, (typeof grants)[number]>();
  for (const g of grants) {
    grantMap.set(
      grantKey(
        g.resource_type as AccessResourceType,
        g.resource_id,
        g.feature_key
      ),
      g
    );
  }

  const isGranted = (
    type: AccessResourceType,
    id?: number | null,
    featureKey?: string | null
  ) => grantMap.get(grantKey(type, id, featureKey))?.effect === "GRANT";

  const isDenied = (
    type: AccessResourceType,
    id?: number | null,
    featureKey?: string | null
  ) => grantMap.get(grantKey(type, id, featureKey))?.effect === "DENY";

  const projectRows: UserAccessProjectRow[] = projects.map((p) => {
    const roleProjet = membershipByProject.get(p.id_projet) ?? null;
    const denied = isDenied("PROJECT", p.id_projet);
    const hasAccess = !denied && membershipByProject.has(p.id_projet);

    return {
      id: p.id_projet,
      name: p.nom_p?.trim() || `Projet #${p.id_projet}`,
      hasAccess,
      denied,
      roleProjet,
      sprints: p.sprint.map((s) => ({
        id: s.id_sprint,
        name: s.nom_s?.trim() || `Sprint #${s.id_sprint}`,
        granted: isGranted("SPRINT", s.id_sprint) || hasAccess,
      })),
      lists: p.list_pm.map((l) => ({
        id: l.id_list,
        name: l.nom?.trim() || `Liste #${l.id_list}`,
        granted: isGranted("LIST", l.id_list) || hasAccess,
      })),
      tasks: p.tache.map((t) => ({
        id: t.id_tache,
        name: t.nom_t?.trim() || `Tâche #${t.id_tache}`,
        granted: isGranted("TASK", t.id_tache) || hasAccess,
      })),
    };
  });

  const features: UserAccessFeatureRow[] = MEMBER_FEATURE_KEYS.map((key) => {
    const meta = PERMISSIONS.find((p) => p.name === key);
    const explicitGrant = isGranted("FEATURE", null, key);
    const explicitDeny = isDenied("FEATURE", null, key);
    const roleDefault = isDefaultFeatureForPoste(user.poste, key);
    return {
      key,
      label: meta?.description ?? key,
      granted: explicitGrant || (roleDefault && !explicitDeny),
      denied: explicitDeny,
    };
  });

  return {
    userId: user.id_utilisateur,
    poste: user.poste,
    projects: projectRows,
    features,
  };
}

export async function saveUserAccess(input: SaveUserAccessInput): Promise<void> {
  const { userId, enterpriseId, grantedById, projects, features = [] } = input;

  const projectIds = projects.map((p) => p.projectId).filter((id) => Number.isFinite(id));
  if (projectIds.length > 0) {
    const validProjects = await prisma.projet.findMany({
      where: {
        id_entreprise: enterpriseId,
        deleted_at: null,
        id_projet: { in: projectIds },
      },
      select: {
        id_projet: true,
        sprint: { where: { deleted_at: null }, select: { id_sprint: true } },
        list_pm: { where: { deleted_at: null }, select: { id_list: true } },
        tache: { where: { deleted_at: null }, select: { id_tache: true } },
      },
    });
    const validProjectSet = new Set(validProjects.map((p) => p.id_projet));
    for (const pid of projectIds) {
      if (!validProjectSet.has(pid)) {
        throw new Error(`Projet #${pid} hors de l'entreprise ou introuvable`);
      }
    }

    const sprintByProject = new Map<number, Set<number>>();
    const listByProject = new Map<number, Set<number>>();
    const taskByProject = new Map<number, Set<number>>();
    for (const p of validProjects) {
      sprintByProject.set(p.id_projet, new Set(p.sprint.map((s) => s.id_sprint)));
      listByProject.set(p.id_projet, new Set(p.list_pm.map((l) => l.id_list)));
      taskByProject.set(p.id_projet, new Set(p.tache.map((t) => t.id_tache)));
    }

    for (const row of projects) {
      for (const sprint of row.sprints ?? []) {
        const allowed = sprintByProject.get(row.projectId);
        if (sprint.granted && allowed && !allowed.has(sprint.id)) {
          throw new Error(`Sprint #${sprint.id} n'appartient pas au projet #${row.projectId}`);
        }
      }
      for (const list of row.lists ?? []) {
        const allowed = listByProject.get(row.projectId);
        if (list.granted && allowed && !allowed.has(list.id)) {
          throw new Error(`Liste #${list.id} n'appartient pas au projet #${row.projectId}`);
        }
      }
      for (const task of row.tasks ?? []) {
        const allowed = taskByProject.get(row.projectId);
        if (task.granted && allowed && !allowed.has(task.id)) {
          throw new Error(`Tâche #${task.id} n'appartient pas au projet #${row.projectId}`);
        }
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const row of projects) {
      const roleLabel = resolveProjectPosteLabel(
        row.roleProjet ?? undefined
      );

      if (row.enabled) {
        await upsertMembreProjetAccess(row.projectId, userId, roleLabel, tx);
        await clearAccessGrant({
          userId,
          resourceType: "PROJECT",
          resourceId: row.projectId,
          tx,
        });
        await upsertAccessGrant({
          userId,
          enterpriseId,
          resourceType: "PROJECT",
          resourceId: row.projectId,
          effect: "GRANT",
          roleProjet: roleLabel,
          grantedById,
          tx,
        });
      } else {
        await removeMembreProjetAccess(row.projectId, userId, tx);
        await upsertAccessGrant({
          userId,
          enterpriseId,
          resourceType: "PROJECT",
          resourceId: row.projectId,
          effect: "DENY",
          grantedById,
          tx,
        });
      }

      for (const sprint of row.sprints ?? []) {
        if (sprint.granted && row.enabled) {
          await upsertAccessGrant({
            userId,
            enterpriseId,
            resourceType: "SPRINT",
            resourceId: sprint.id,
            effect: "GRANT",
            grantedById,
            tx,
          });
        } else {
          await clearAccessGrant({
            userId,
            resourceType: "SPRINT",
            resourceId: sprint.id,
            tx,
          });
        }
      }

      for (const list of row.lists ?? []) {
        if (list.granted && row.enabled) {
          await upsertAccessGrant({
            userId,
            enterpriseId,
            resourceType: "LIST",
            resourceId: list.id,
            effect: "GRANT",
            grantedById,
            tx,
          });
        } else {
          await clearAccessGrant({
            userId,
            resourceType: "LIST",
            resourceId: list.id,
            tx,
          });
        }
      }

      for (const task of row.tasks ?? []) {
        if (task.granted && row.enabled) {
          await upsertAccessGrant({
            userId,
            enterpriseId,
            resourceType: "TASK",
            resourceId: task.id,
            effect: "GRANT",
            grantedById,
            tx,
          });
        } else {
          await clearAccessGrant({
            userId,
            resourceType: "TASK",
            resourceId: task.id,
            tx,
          });
        }
      }
    }

    for (const feature of features) {
      if (feature.granted) {
        await upsertAccessGrant({
          userId,
          enterpriseId,
          resourceType: "FEATURE",
          featureKey: feature.key,
          effect: "GRANT",
          grantedById,
          tx,
        });
      } else {
        await clearAccessGrant({
          userId,
          resourceType: "FEATURE",
          featureKey: feature.key,
          tx,
        });
      }
    }
  });
}
