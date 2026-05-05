import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting SuperAdmin seed...');
  
  try {
    const hashedPassword = await bcrypt.hash('superadmin123', 10);
    
    // 1. Ensure System Enterprise exists
    let entreprise = await prisma.entreprise.findFirst({
      where: { nom: "System Enterprise" }
    });
    
    if (!entreprise) {
      entreprise = await prisma.entreprise.create({
        data: {
          nom: "System Enterprise",
          adresse: "System Location",
          createdAt: new Date()
        }
      });
      console.log('🏢 System Enterprise created.');
    }

    // 2. Ensure SuperAdmin Role exists
    const superAdminRole = await prisma.role.upsert({
      where: { id_role: 1 },
      update: { nom: 'SuperAdmin' },
      create: {
        id_role: 1,
        nom: 'SuperAdmin',
        description: 'Administrateur suprême de la plateforme',
        id_entreprise: entreprise.id_entreprise
      }
    });
    console.log('🛡️ SuperAdmin Role verified.');

    // 3. Create or Fix SuperAdmin user
    const superAdminEmail = 'superadmin@gp.com';
    const user = await prisma.utilisateur.upsert({
      where: { email: superAdminEmail },
      update: { 
        statut: 'ACTIVE', 
        id_role: superAdminRole.id_role,
        password: hashedPassword,
        id_entreprise: entreprise.id_entreprise
      },
      create: {
        nom: 'Admin',
        prenom: 'Super',
        email: superAdminEmail,
        password: hashedPassword,
        id_role: superAdminRole.id_role,
        statut: 'ACTIVE',
        id_entreprise: entreprise.id_entreprise
      }
    });

    console.log('✅ Super Admin account is ready !');
    console.log(`📧 Email: ${superAdminEmail}`);
    console.log('🔑 Password: superadmin123');
    console.log(`📊 Current Status: ${user.statut}`);

  } catch (error) {
    console.error('❌ Error seeding SuperAdmin:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
