import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Idempotent SuperAdmin bootstrap.
 *
 * IMPORTANT: this script must NEVER silently overwrite an existing
 * SuperAdmin password. Doing so was the root cause of a "login regression"
 * after re-running the seed during the recent hierarchy / tenant-role
 * refactor.
 *
 * Behavior:
 *   - On CREATE: sets the canonical default password ("superadmin123").
 *   - On UPDATE: preserves the existing password by default.
 *   - Set SEED_FORCE_PASSWORD_RESET=1 to explicitly reset the password
 *     (use this for emergency recovery only).
 */
async function main() {
  console.log('[seed:superadmin] Starting...');

  const forceReset = process.env.SEED_FORCE_PASSWORD_RESET === '1';
  const superAdminEmail = 'superadmin@gp.com';
  const defaultPassword = 'superadmin123';

  try {
    let entreprise = await prisma.entreprise.findFirst({
      where: { nom: 'System Enterprise' },
    });
    if (!entreprise) {
      entreprise = await prisma.entreprise.create({
        data: {
          nom: 'System Enterprise',
          adresse: 'System Location',
          createdAt: new Date(),
        },
      });
      console.log('[seed:superadmin] System Enterprise created.');
    }

    const superAdminRole = await prisma.role.upsert({
      where: { id_role: 1 },
      update: { nom: 'SuperAdmin' },
      create: {
        id_role: 1,
        nom: 'SuperAdmin',
        description: 'Administrateur suprême de la plateforme',
        id_entreprise: entreprise.id_entreprise,
      },
    });
    console.log('[seed:superadmin] SuperAdmin role verified.');

    const existing = await prisma.utilisateur.findUnique({
      where: { email: superAdminEmail },
    });

    if (!existing) {
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      const created = await prisma.utilisateur.create({
        data: {
          nom: 'Admin',
          prenom: 'Super',
          email: superAdminEmail,
          password: hashedPassword,
          id_role: superAdminRole.id_role,
          statut: 'ACTIVE',
          id_entreprise: entreprise.id_entreprise,
        },
      });
      console.log('[seed:superadmin] SuperAdmin user CREATED.');
      console.log(`  email   : ${superAdminEmail}`);
      console.log(`  password: ${defaultPassword}  (please change it after first login)`);
      console.log(`  status  : ${created.statut}`);
      return;
    }

    const updateData: Record<string, unknown> = {
      statut: 'ACTIVE',
      id_role: superAdminRole.id_role,
      id_entreprise: entreprise.id_entreprise,
    };
    if (forceReset) {
      updateData.password = await bcrypt.hash(defaultPassword, 10);
    }

    const updated = await prisma.utilisateur.update({
      where: { email: superAdminEmail },
      data: updateData,
    });

    console.log('[seed:superadmin] SuperAdmin user already existed — updated safely.');
    console.log(`  email   : ${superAdminEmail}`);
    console.log(
      forceReset
        ? `  password: RESET to "${defaultPassword}" (SEED_FORCE_PASSWORD_RESET=1)`
        : '  password: PRESERVED (existing hash kept). Set SEED_FORCE_PASSWORD_RESET=1 to reset.'
    );
    console.log(`  status  : ${updated.statut}`);
  } catch (error) {
    console.error('[seed:superadmin] FAILED:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
