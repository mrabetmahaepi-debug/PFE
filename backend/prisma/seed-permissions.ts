import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed permissions...');

  const permissions = [
    // Projets
    { nom: 'PROJECT_CREATE', description: 'Créer de nouveaux projets' },
    { nom: 'PROJECT_EDIT', description: 'Modifier les projets existants' },
    { nom: 'PROJECT_DELETE', description: 'Supprimer des projets' },
    { nom: 'PROJECT_VIEW_ALL', description: 'Voir tous les projets de l\'entreprise' },
    
    // Tâches
    { nom: 'TASK_CREATE', description: 'Créer des tâches' },
    { nom: 'TASK_EDIT', description: 'Modifier des tâches' },
    { nom: 'TASK_DELETE', description: 'Supprimer des tâches' },
    { nom: 'TASK_VIEW_ALL', description: 'Voir toutes les tâches du projet' },
    
    // Équipe
    { nom: 'TEAM_INVITE', description: 'Inviter de nouveaux membres' },
    { nom: 'TEAM_MANAGE_ROLES', description: 'Gérer les rôles et permissions' },
    { nom: 'TEAM_VIEW', description: 'Voir les membres de l\'équipe' },
    
    // Entreprise
    { nom: 'ENTERPRISE_EDIT', description: 'Modifier les informations de l\'entreprise' },
    { nom: 'ENTERPRISE_STATS', description: 'Voir les statistiques de l\'entreprise' },
    
    // Système
    { nom: 'SYSTEM_MANAGE_ALL', description: 'Contrôle total du système (SuperAdmin)' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { nom: perm.nom },
      update: { description: perm.description },
      create: perm,
    });
  }

  console.log('Permissions seeded.');

  // Find all permissions to link them
  const allPerms = await prisma.permission.findMany();
  
  // Define default permission sets
  const adminPerms = allPerms.filter(p => p.nom !== 'SYSTEM_MANAGE_ALL');
  const chefProjetPerms = allPerms.filter(p => 
    p.nom.startsWith('PROJECT_VIEW') || 
    p.nom.startsWith('TASK_') || 
    p.nom === 'TEAM_VIEW'
  );
  const membrePerms = allPerms.filter(p => 
    p.nom === 'PROJECT_VIEW_ALL' || 
    p.nom === 'TASK_VIEW_ALL' || 
    p.nom === 'TEAM_VIEW'
  );
  const superAdminPerms = allPerms;

  // Roles to ensure exist (at least for the first enterprise or system-wide)
  // Note: Roles are normally linked to an enterprise. 
  // We'll update existing roles if they exist.
  
  const roles = await prisma.role.findMany();
  
  for (const role of roles) {
    let permsToAssign: any[] = [];
    
    if (role.nom === 'SuperAdmin') permsToAssign = superAdminPerms;
    else if (role.nom === 'Admin') permsToAssign = adminPerms;
    else if (role.nom === 'Chef de Projet') permsToAssign = chefProjetPerms;
    else if (role.nom === 'Membre') permsToAssign = membrePerms;

    if (permsToAssign.length > 0) {
      await prisma.role.update({
        where: { id_role: role.id_role },
        data: {
          permissions: {
            set: permsToAssign.map(p => ({ id_permission: p.id_permission }))
          }
        }
      });
      console.log(`Updated permissions for role: ${role.nom}`);
    }
  }

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
