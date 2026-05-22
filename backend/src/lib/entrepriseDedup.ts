import prisma from "../prisma/prismaClient";
import { computePresenceOnline } from "./presence";

export const ADMIN_ROLE_NAMES = ["Admin", "ADMIN", "admin", "Administrateur"];

export function isAdminRoleName(roleName: string | null | undefined): boolean {
  const norm = String(roleName ?? "")
    .trim()
    .toLowerCase();
  if (!norm) return false;
  return (
    ADMIN_ROLE_NAMES.some((r) => r.toLowerCase() === norm) ||
    norm.includes("admin")
  );
}

export function normalizeEnterpriseName(name: string | null | undefined): string {
  return String(name ?? "")
    .trim()
    .toLowerCase();
}

export async function findEntrepriseByNormalizedName(nom: string) {
  const key = normalizeEnterpriseName(nom);
  if (!key) return null;

  const rows = await prisma.entreprise.findMany({
    where: { nom: { not: null } },
    orderBy: { id_entreprise: "asc" },
  });

  return rows.find((e) => normalizeEnterpriseName(e.nom) === key) ?? null;
}

export async function resolveCanonicalEnterpriseId(
  id_entreprise: number
): Promise<number> {
  const ent = await prisma.entreprise.findUnique({
    where: { id_entreprise },
    select: { id_entreprise: true, nom: true },
  });
  if (!ent?.nom) return id_entreprise;

  const key = normalizeEnterpriseName(ent.nom);
  const group = await prisma.entreprise.findMany({
    where: { nom: { not: null } },
    select: { id_entreprise: true, nom: true },
    orderBy: { id_entreprise: "asc" },
  });

  const ids = group
    .filter((e) => normalizeEnterpriseName(e.nom) === key)
    .map((e) => e.id_entreprise);

  return ids.length ? Math.min(...ids) : id_entreprise;
}

/** Move users/projects off duplicate enterprise rows onto the canonical record. */
export async function consolidateDuplicateEnterprisesByName(): Promise<void> {
  const all = await prisma.entreprise.findMany({
    select: { id_entreprise: true, nom: true },
    orderBy: { id_entreprise: "asc" },
  });

  const groups = new Map<string, number[]>();
  for (const e of all) {
    const key = normalizeEnterpriseName(e.nom);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(e.id_entreprise);
    groups.set(key, list);
  }

  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    const canonical = Math.min(...ids);
    const duplicates = ids.filter((id) => id !== canonical);
    if (!duplicates.length) continue;

    const canonicalAdminRole = await prisma.role.findFirst({
      where: {
        id_entreprise: canonical,
        nom: { in: ADMIN_ROLE_NAMES },
      },
    });

    await prisma.$transaction(async (tx) => {
      for (const dupId of duplicates) {
        if (canonicalAdminRole) {
          await tx.utilisateur.updateMany({
            where: {
              id_entreprise: dupId,
              role: { nom: { in: ADMIN_ROLE_NAMES } },
            },
            data: {
              id_entreprise: canonical,
              id_role: canonicalAdminRole.id_role,
            },
          });
        }

        await tx.utilisateur.updateMany({
          where: { id_entreprise: dupId },
          data: { id_entreprise: canonical },
        });

        await tx.projet.updateMany({
          where: { id_entreprise: dupId },
          data: { id_entreprise: canonical },
        });

        await tx.invitation.updateMany({
          where: { id_entreprise: dupId },
          data: { id_entreprise: canonical },
        });

        await tx.conversation.updateMany({
          where: { id_entreprise: dupId },
          data: { id_entreprise: canonical },
        });

        const dupAdminRole = await tx.role.findFirst({
          where: {
            id_entreprise: dupId,
            nom: { in: ADMIN_ROLE_NAMES },
          },
        });
        const dupMemberRole = await tx.role.findFirst({
          where: { id_entreprise: dupId, nom: "Membre" },
        });
        const canonicalMemberRole = await tx.role.findFirst({
          where: { id_entreprise: canonical, nom: "Membre" },
        });

        if (dupAdminRole && canonicalAdminRole) {
          await tx.utilisateur.updateMany({
            where: { id_role: dupAdminRole.id_role },
            data: {
              id_role: canonicalAdminRole.id_role,
              id_entreprise: canonical,
            },
          });
        }
        if (dupMemberRole && canonicalMemberRole) {
          await tx.utilisateur.updateMany({
            where: { id_role: dupMemberRole.id_role },
            data: {
              id_role: canonicalMemberRole.id_role,
              id_entreprise: canonical,
            },
          });
        }

        await tx.role.deleteMany({ where: { id_entreprise: dupId } });

        await tx.entreprise.update({
          where: { id_entreprise: dupId },
          data: { admin_id: null },
        });

        await tx.entreprise.delete({ where: { id_entreprise: dupId } });
      }
    });
  }

  await repairEnterpriseAdminRoles();
}

/** Restore Admin role for enterprise primary admins (e.g. after duplicate role purge). */
export async function repairEnterpriseAdminRoles(): Promise<void> {
  const enterprises = await prisma.entreprise.findMany({
    where: { admin_id: { not: null } },
    select: { id_entreprise: true, admin_id: true },
  });

  for (const ent of enterprises) {
    if (!ent.admin_id) continue;

    const adminRole = await prisma.role.findFirst({
      where: {
        id_entreprise: ent.id_entreprise,
        nom: { in: ADMIN_ROLE_NAMES },
      },
    });
    if (!adminRole) continue;

    await prisma.utilisateur.update({
      where: { id_utilisateur: ent.admin_id },
      data: {
        id_role: adminRole.id_role,
        id_entreprise: ent.id_entreprise,
      },
    });
  }

  const linkedAdmins = await prisma.utilisateur.findMany({
    where: { adminOf: { isNot: null } },
    select: {
      id_utilisateur: true,
      id_role: true,
      adminOf: { select: { id_entreprise: true } },
    },
  });

  for (const user of linkedAdmins) {
    const entId = user.adminOf?.id_entreprise;
    if (!entId) continue;

    const adminRole = await prisma.role.findFirst({
      where: {
        id_entreprise: entId,
        nom: { in: ADMIN_ROLE_NAMES },
      },
    });
    if (!adminRole || user.id_role === adminRole.id_role) continue;

    await prisma.utilisateur.update({
      where: { id_utilisateur: user.id_utilisateur },
      data: {
        id_role: adminRole.id_role,
        id_entreprise: entId,
      },
    });
  }
}

type AdminRow = {
  id_utilisateur: number;
  nom: string | null;
  prenom: string | null;
  email: string | null;
  telephone?: string | null;
  isOnline: boolean;
  lastSeen: Date | null;
};

export function mapAdminPresence(admin: AdminRow) {
  return {
    ...admin,
    isOnline: computePresenceOnline(!!admin.isOnline, admin.lastSeen ?? null),
  };
}

export const ADMIN_USER_SELECT = {
  id_utilisateur: true,
  nom: true,
  prenom: true,
  email: true,
  telephone: true,
  createdAt: true,
  isOnline: true,
  lastSeen: true,
} as const;

/** All enterprise rows sharing the same normalized company name. */
export async function getEnterpriseIdsInNameGroup(
  enterpriseId: number
): Promise<number[]> {
  const ent = await prisma.entreprise.findUnique({
    where: { id_entreprise: enterpriseId },
    select: { id_entreprise: true, nom: true },
  });
  if (!ent?.nom) return [enterpriseId];

  const key = normalizeEnterpriseName(ent.nom);
  const all = await prisma.entreprise.findMany({
    where: { nom: { not: null } },
    select: { id_entreprise: true, nom: true },
    orderBy: { id_entreprise: "asc" },
  });

  const ids = all
    .filter((e) => normalizeEnterpriseName(e.nom) === key)
    .map((e) => e.id_entreprise);

  return ids.length ? ids : [enterpriseId];
}

/** Shared collector — same rules as buildMergedEnterpriseList. */
export async function collectCompanyAdminsForGroupIds(
  groupIds: number[]
): Promise<ReturnType<typeof mapAdminPresence>[]> {
  const [entreprises, usersOnGroup] = await Promise.all([
    prisma.entreprise.findMany({
      where: { id_entreprise: { in: groupIds } },
      select: {
        admin_id: true,
        admin: { select: ADMIN_USER_SELECT },
      },
    }),
    prisma.utilisateur.findMany({
      where: {
        id_entreprise: { in: groupIds },
        statut: { not: "REJECTED" },
      },
      select: {
        ...ADMIN_USER_SELECT,
        role: { select: { nom: true } },
      },
    }),
  ]);

  const adminIdSet = new Set(
    entreprises
      .map((e) => e.admin_id)
      .filter((id): id is number => id != null)
  );

  const adminMap = new Map<number, ReturnType<typeof mapAdminPresence>>();

  for (const ent of entreprises) {
    if (ent.admin) {
      adminMap.set(ent.admin.id_utilisateur, mapAdminPresence(ent.admin));
    }
  }

  for (const u of usersOnGroup) {
    const isTenantAdmin = isAdminRoleName(u.role?.nom);
    const isPrimaryAdmin = adminIdSet.has(u.id_utilisateur);
    if (!isTenantAdmin && !isPrimaryAdmin) continue;
    const { role: _role, ...row } = u;
    adminMap.set(row.id_utilisateur, mapAdminPresence(row));
  }

  const missingPrimaryIds = [...adminIdSet].filter((id) => !adminMap.has(id));
  if (missingPrimaryIds.length) {
    const primaryAdmins = await prisma.utilisateur.findMany({
      where: {
        id_utilisateur: { in: missingPrimaryIds },
        statut: { not: "REJECTED" },
      },
      select: ADMIN_USER_SELECT,
    });
    for (const u of primaryAdmins) {
      adminMap.set(u.id_utilisateur, mapAdminPresence(u));
    }
  }

  const adminOfUsers = await prisma.utilisateur.findMany({
    where: {
      adminOf: { id_entreprise: { in: groupIds } },
      statut: { not: "REJECTED" },
    },
    select: ADMIN_USER_SELECT,
  });
  for (const u of adminOfUsers) {
    adminMap.set(u.id_utilisateur, mapAdminPresence(u));
  }

  return Array.from(adminMap.values()).sort((a, b) =>
    `${a.prenom ?? ""} ${a.nom ?? ""}`.localeCompare(
      `${b.prenom ?? ""} ${b.nom ?? ""}`,
      "fr"
    )
  );
}

/** All tenant admins linked to a company (same logic as merged list view). */
export async function getEnterpriseAdminsByCompanyId(
  enterpriseId: number
): Promise<ReturnType<typeof mapAdminPresence>[]> {
  const canonicalId = await resolveCanonicalEnterpriseId(enterpriseId);
  const groupIds = await getEnterpriseIdsInNameGroup(canonicalId);
  return collectCompanyAdminsForGroupIds(groupIds);
}

export type EnterpriseListRow = {
  id_entreprise: number;
  nom: string | null;
  adresse: string | null;
  telephone: string | null;
  createdAt: Date | null;
  statut: string | null;
  admin_id: number | null;
  admin: ReturnType<typeof mapAdminPresence> | null;
  admins: ReturnType<typeof mapAdminPresence>[];
};

/** One card per company name; merges admins from duplicate rows. */
export async function buildMergedEnterpriseList(): Promise<EnterpriseListRow[]> {
  const entreprises = await prisma.entreprise.findMany({
    orderBy: { id_entreprise: "asc" },
    include: {
      admin: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          telephone: true,
          isOnline: true,
          lastSeen: true,
        },
      },
    },
  });

  const groups = new Map<string, typeof entreprises>();
  for (const e of entreprises) {
    const key =
      normalizeEnterpriseName(e.nom) || `__id_${e.id_entreprise}`;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }

  const merged: EnterpriseListRow[] = [];

  for (const group of groups.values()) {
    const primary = group.reduce((a, b) =>
      a.id_entreprise < b.id_entreprise ? a : b
    );
    const ids = group.map((g) => g.id_entreprise);
    const admins = await collectCompanyAdminsForGroupIds(ids);

    merged.push({
      id_entreprise: primary.id_entreprise,
      nom: primary.nom,
      adresse: primary.adresse,
      telephone: primary.telephone,
      createdAt: primary.createdAt,
      statut: primary.statut,
      admin_id: primary.admin_id,
      admin: admins[0] ?? null,
      admins,
    });
  }

  merged.sort((a, b) => b.id_entreprise - a.id_entreprise);
  return merged;
}
