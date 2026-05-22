import { PrismaClient } from "@prisma/client";
import {
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
} from "../src/modules/permissions/permissions.catalog";

const prisma = new PrismaClient();

/**
 * Seed strategy
 * -------------
 * - UPSERT every catalog permission by name. Description is updated,
 *   existing rows are preserved.
 * - For SYSTEM-shipped roles (SuperAdmin / Admin / Chef de Projet /
 *   Membre) we MERGE the default permission set into the existing
 *   assignments, never `set`-ing or removing manually-curated permissions.
 * - Custom enterprise roles (any role.nom not in the system list) are
 *   left untouched.
 */
async function main() {
  console.log("[seed-permissions] Starting...");

  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { nom: perm.name },
      update: { description: perm.description },
      create: { nom: perm.name, description: perm.description },
    });
  }
  console.log(`[seed-permissions] ${PERMISSIONS.length} permissions upserted.`);

  const allPerms = await prisma.permission.findMany();
  const permByName = new Map<string, number>();
  for (const p of allPerms) {
    if (p.nom) permByName.set(p.nom, p.id_permission);
  }

  const systemRoleNames = Object.keys(DEFAULT_ROLE_PERMISSIONS);
  const roles = await prisma.role.findMany({
    where: { nom: { in: systemRoleNames } },
    include: { permission: true } as any,
  });

  for (const role of roles) {
    const roleName = role.nom ?? "";
    const desired: string[] = DEFAULT_ROLE_PERMISSIONS[roleName] || [];
    const desiredIds: number[] = [];
    for (const n of desired) {
      const id = permByName.get(n);
      if (typeof id === "number") desiredIds.push(id);
    }

    const existingIds = new Set<number>(
      (((role as any).permission as Array<{ id_permission: number }>) || []).map(
        (p) => p.id_permission
      )
    );

    const missing: number[] = desiredIds.filter((id) => !existingIds.has(id));
    if (missing.length === 0) {
      console.log(
        `[seed-permissions] role "${roleName}" already has every default permission`
      );
      continue;
    }

    await prisma.role.update({
      where: { id_role: role.id_role },
      data: {
        permission: {
          connect: missing.map((id) => ({ id_permission: id })),
        },
      } as any,
    });
    console.log(
      `[seed-permissions] role "${roleName}" gained ${missing.length} new default permission(s)`
    );
  }

  console.log("[seed-permissions] Done.");
}

main()
  .catch((e) => {
    console.error("[seed-permissions] FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
