import { PrismaClient } from "@prisma/client";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
} from "../modules/permissions/permissions.catalog";

const prisma = new PrismaClient();

const TENANT_ROLE_NAMES = ["Admin", "Membre"] as const;

const SYSTEM_ROLE_NAME = "SuperAdmin";
const dryRun = process.argv.includes("--dry");

type TenantRoleName = (typeof TENANT_ROLE_NAMES)[number];

function roleNameOrMembre(name?: string | null): TenantRoleName {
  if (!name || name === SYSTEM_ROLE_NAME) return "Membre";
  if (TENANT_ROLE_NAMES.includes(name as TenantRoleName)) {
    return name as TenantRoleName;
  }
  return "Membre";
}

async function main() {
  console.log(`[tenant-roles] Starting${dryRun ? " (dry-run)" : ""}...`);

  // Ensure canonical permission rows exist before role cloning.
  for (const perm of PERMISSIONS) {
    if (dryRun) continue;
    await prisma.permission.upsert({
      where: { nom: perm.name },
      update: { description: perm.description },
      create: { nom: perm.name, description: perm.description },
    });
  }

  const [enterprises, users, existingRoles, permissions] = await Promise.all([
    prisma.entreprise.findMany({ orderBy: { id_entreprise: "asc" } }),
    prisma.utilisateur.findMany({
      include: { role: true },
      orderBy: { id_utilisateur: "asc" },
    }),
    prisma.role.findMany({
      include: { permission: true } as any,
      orderBy: { id_role: "asc" },
    }),
    prisma.permission.findMany(),
  ]);

  const permissionIdByName = new Map(
    permissions.map((p) => [p.nom, p.id_permission])
  );

  const defaultPermIdsByRole = new Map<string, number[]>();
  for (const roleName of Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
    const ids = DEFAULT_ROLE_PERMISSIONS[roleName]
      .map((name) => permissionIdByName.get(name))
      .filter((id): id is number => typeof id === "number");
    defaultPermIdsByRole.set(roleName, ids);
  }

  const sourcePermIdsByRole = new Map<string, number[]>();
  for (const role of existingRoles) {
    if (!role.nom) continue;
    const current = sourcePermIdsByRole.get(role.nom) || [];
    const ids = (((role as any).permission as any[]) || []).map(
      (p: any) => p.id_permission as number
    );
    sourcePermIdsByRole.set(role.nom, Array.from(new Set([...current, ...ids])));
  }

  const rolesToCreateOrUpdate = enterprises.length * TENANT_ROLE_NAMES.length;
  const usersToRepoint = users.filter((u) => {
    if (u.role?.nom === SYSTEM_ROLE_NAME) return false;
    if (!u.id_entreprise) return false;
    const targetName = roleNameOrMembre(u.role?.nom);
    const target = existingRoles.find(
      (r) => r.nom === targetName && r.id_entreprise === u.id_entreprise
    );
    return !target || u.id_role !== target.id_role;
  });

  console.log(`[tenant-roles] enterprises: ${enterprises.length}`);
  console.log(`[tenant-roles] roles to ensure: ${rolesToCreateOrUpdate}`);
  console.log(`[tenant-roles] users to repoint: ${usersToRepoint.length}`);

  if (dryRun) {
    for (const u of usersToRepoint) {
      console.log(
        `[tenant-roles] DRY user ${u.id_utilisateur} ${u.email} -> ${roleNameOrMembre(
          u.role?.nom
        )} in enterprise ${u.id_entreprise}`
      );
    }
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const enterprise of enterprises) {
      for (const roleName of TENANT_ROLE_NAMES) {
        const basePermIds = [
          ...(sourcePermIdsByRole.get(roleName) || []),
          ...(defaultPermIdsByRole.get(roleName) || []),
        ];
        const uniquePermIds = Array.from(new Set(basePermIds));

        const existing = await tx.role.findFirst({
          where: {
            nom: roleName,
            id_entreprise: enterprise.id_entreprise,
          },
          include: { permission: true } as any,
        });

        if (!existing) {
          await tx.role.create({
            data: {
              nom: roleName,
              description: `Rôle ${roleName} de ${enterprise.nom || "workspace"}`,
              id_entreprise: enterprise.id_entreprise,
              permission: {
                connect: uniquePermIds.map((id) => ({ id_permission: id })),
              },
            } as any,
          });
          console.log(
            `[tenant-roles] created ${roleName} for enterprise ${enterprise.id_entreprise}`
          );
          continue;
        }

        const existingPermIds = new Set(
          (((existing as any).permission as any[]) || []).map(
            (p: any) => p.id_permission as number
          )
        );
        const missing = uniquePermIds.filter((id) => !existingPermIds.has(id));
        if (missing.length > 0) {
          await tx.role.update({
            where: { id_role: existing.id_role },
            data: {
              permission: {
                connect: missing.map((id) => ({ id_permission: id })),
              },
            } as any,
          });
          console.log(
            `[tenant-roles] updated ${roleName} for enterprise ${enterprise.id_entreprise} (+${missing.length} permission)`
          );
        }
      }
    }

    const refreshedRoles = await tx.role.findMany();
    for (const user of users) {
      if (user.role?.nom === SYSTEM_ROLE_NAME) continue;
      if (!user.id_entreprise) continue;

      const targetName = roleNameOrMembre(user.role?.nom);
      const target = refreshedRoles.find(
        (r) => r.nom === targetName && r.id_entreprise === user.id_entreprise
      );
      if (!target) continue;
      if (user.id_role === target.id_role) continue;

      await tx.utilisateur.update({
        where: { id_utilisateur: user.id_utilisateur },
        data: { id_role: target.id_role },
      });
      console.log(
        `[tenant-roles] user ${user.id_utilisateur} ${user.email} -> role ${targetName} (${target.id_role})`
      );
    }
  });

  console.log("[tenant-roles] Done.");
}

main()
  .catch((err) => {
    console.error("[tenant-roles] FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
