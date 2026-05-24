import type { Prisma } from "@prisma/client";
import prisma from "../prisma/prismaClient";

const CHEF_ROLE_LABELS = [
  "Chef de projet",
  "Chef",
  "CHEF DE PROJET",
  "chef de projet",
  "Project Manager",
];

export type AdminRecommendationScope = {
  enterpriseId: number;
  adminUserId: number;
  projectIds: Set<number>;
};

/** Projects managed by the connected admin within their enterprise workspace. */
export function adminManagedProjectsWhere(
  enterpriseId: number,
  adminUserId: number
): Prisma.projetWhereInput {
  return {
    id_entreprise: enterpriseId,
    deleted_at: null,
    OR: [
      { chef_de_projet_id: adminUserId },
      {
        membre_projet: {
          some: {
            id_utilisateur: adminUserId,
            role_projet: { in: CHEF_ROLE_LABELS },
          },
        },
      },
      {
        affectation: {
          some: {
            id_utilisateur: adminUserId,
            id_tache: null,
            role_affectation: "chef",
          },
        },
      },
    ],
  };
}

export async function getAdminManagedProjectIds(
  enterpriseId: number,
  adminUserId: number
): Promise<number[]> {
  if (!Number.isFinite(enterpriseId) || enterpriseId <= 0) return [];
  if (!Number.isFinite(adminUserId) || adminUserId <= 0) return [];

  const rows = await prisma.projet.findMany({
    where: adminManagedProjectsWhere(enterpriseId, adminUserId),
    select: { id_projet: true },
  });

  return rows.map((r) => r.id_projet);
}

export async function loadAdminRecommendationScope(
  enterpriseId: number,
  adminUserId: number
): Promise<AdminRecommendationScope> {
  const projectIds = await getAdminManagedProjectIds(enterpriseId, adminUserId);
  return {
    enterpriseId,
    adminUserId,
    projectIds: new Set(projectIds),
  };
}

export function isProjectInAdminScope(
  projectId: number | null | undefined,
  scope: AdminRecommendationScope
): boolean {
  if (projectId == null || !Number.isFinite(projectId) || projectId <= 0) return true;
  return scope.projectIds.has(projectId);
}

export function isMemberInAdminScope(
  memberId: number | null | undefined,
  scopedMemberIds: Set<number>
): boolean {
  if (memberId == null || !Number.isFinite(memberId) || memberId <= 0) return true;
  return scopedMemberIds.has(memberId);
}
