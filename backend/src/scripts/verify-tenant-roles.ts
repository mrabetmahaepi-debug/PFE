import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_ROLE_NAMES = ["Admin", "Membre"] as const;

async function main() {
  const enterprises = await prisma.entreprise.findMany({
    orderBy: { id_entreprise: "asc" },
    include: {
      role: {
        include: { permission: true } as any,
      },
    } as any,
  });

  let allOk = true;
  for (const ent of enterprises as any[]) {
    const names = new Set((ent.role as any[]).map((r) => r.nom));
    const missing = TENANT_ROLE_NAMES.filter((n) => !names.has(n));
    const ok = missing.length === 0;
    if (!ok) allOk = false;
    console.log(
      `enterprise ${ent.id_entreprise} ${ent.nom || ""} -> roles=${ent.role.length} missing=[${missing.join(",")}]`
    );
    for (const role of ent.role as any[]) {
      const perms = (role.permission as any[] | undefined)?.length ?? 0;
      console.log(`  - ${role.nom} (id=${role.id_role}) perms=${perms}`);
    }
  }

  const usersAcross = await prisma.utilisateur.findMany({
    include: { role: true },
  });
  const crossTenant = usersAcross.filter((u) => {
    if (!u.role) return false;
    if (u.role.nom === "SuperAdmin") return false;
    if (!u.id_entreprise) return false;
    return u.role.id_entreprise !== u.id_entreprise;
  });
  console.log(`\ncross-tenant users: ${crossTenant.length}`);
  for (const u of crossTenant) {
    console.log(
      `  user ${u.id_utilisateur} ${u.email} entreprise=${u.id_entreprise} role=${u.role?.nom}(ent=${u.role?.id_entreprise})`
    );
  }

  if (!allOk || crossTenant.length > 0) {
    console.error("VERIFICATION FAILED");
    process.exit(2);
  }
  console.log("\nVERIFICATION OK");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
