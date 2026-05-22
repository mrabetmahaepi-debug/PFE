/**
 * Tenant role provisioning
 * ------------------------
 * Single source of truth for "what tenant-side roles must exist for a given
 * enterprise". Used by:
 *   - the seed script (`scripts/seed-tenant-roles.ts`) to backfill existing
 *     enterprises in bulk,
 *   - the enterprise creation controller, so a brand-new tenant is born
 *     with **Admin** and **Membre** roles (compte global uniquement).
 *     Les rôles métier (Chef de Projet, Développeur, …) sont **par projet**
 *     via `membre_projet.role_projet`, pas via `role` utilisateur.
 *
 * Idempotent by design: re-running it is safe and only fills gaps.
 */
import type { PrismaClient } from "@prisma/client";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
} from "../modules/permissions/permissions.catalog";

export const TENANT_ROLE_NAMES = ["Admin", "Membre"] as const;

export type TenantRoleName = (typeof TENANT_ROLE_NAMES)[number];

export interface ProvisionResult {
  created: TenantRoleName[];
  updated: TenantRoleName[];
  unchanged: TenantRoleName[];
}

/**
 * Make sure every canonical permission row exists. Cheap upsert, called
 * defensively because freshly-restored databases sometimes lack the
 * latest catalog additions.
 */
export async function ensurePermissionsCatalog(prisma: PrismaClient) {
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { nom: perm.name },
      update: { description: perm.description },
      create: { nom: perm.name, description: perm.description },
    });
  }
}

/**
 * Ensure the canonical tenant roles exist (with their default permission
 * set) for a given enterprise. Existing roles are augmented with any
 * missing permission, never stripped, so admin-customized roles keep
 * their additions.
 */
export async function provisionTenantRoles(
  prisma: PrismaClient,
  idEntreprise: number,
  options: { enterpriseName?: string | null } = {}
): Promise<ProvisionResult> {
  const result: ProvisionResult = {
    created: [],
    updated: [],
    unchanged: [],
  };

  await ensurePermissionsCatalog(prisma);

  const allPermissions = await prisma.permission.findMany({
    select: { id_permission: true, nom: true },
  });
  const permissionIdByName = new Map(
    allPermissions.map((p) => [p.nom, p.id_permission])
  );

  const resolveIds = (names: string[]) =>
    Array.from(
      new Set(
        names
          .map((n) => permissionIdByName.get(n))
          .filter((id): id is number => typeof id === "number")
      )
    );

  for (const roleName of TENANT_ROLE_NAMES) {
    const targetIds = resolveIds(DEFAULT_ROLE_PERMISSIONS[roleName] ?? []);

    const existing = await prisma.role.findFirst({
      where: { nom: roleName, id_entreprise: idEntreprise },
      include: { permission: true } as any,
    });

    if (!existing) {
      await prisma.role.create({
        data: {
          nom: roleName,
          description: `Rôle ${roleName} de ${
            options.enterpriseName || "l'entreprise"
          }`,
          id_entreprise: idEntreprise,
          permission: {
            connect: targetIds.map((id) => ({ id_permission: id })),
          },
        } as any,
      });
      result.created.push(roleName);
      continue;
    }

    const currentIds = new Set(
      (((existing as any).permission as any[]) || []).map(
        (p: any) => p.id_permission as number
      )
    );
    const missing = targetIds.filter((id) => !currentIds.has(id));
    if (missing.length === 0) {
      result.unchanged.push(roleName);
      continue;
    }

    await prisma.role.update({
      where: { id_role: existing.id_role },
      data: {
        permission: {
          connect: missing.map((id) => ({ id_permission: id })),
        },
      } as any,
    });
    result.updated.push(roleName);
  }

  return result;
}
