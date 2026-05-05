import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const entreprise = await prisma.entreprise.findFirst();
  if (!entreprise) {
    console.log("❌ Veuillez d'abord créer une entreprise (via le Super Admin).");
    return;
  }

  const roles = [
    { id_role: 1, nom: 'SuperAdmin', description: 'Accès total à la plateforme' },
    { id_role: 2, nom: 'Admin', description: 'Gère son entreprise et ses projets' },
    { id_role: 3, nom: 'Chef de Projet', description: 'Gère l\'avancement et les membres des projets assignés' },
    { id_role: 4, nom: 'Membre', description: 'Exécute les tâches et rapporte l\'avancement' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { id_role: role.id_role },
      update: { nom: role.nom, description: role.description },
      create: { 
        id_role: role.id_role, 
        nom: role.nom, 
        description: role.description,
        id_entreprise: entreprise.id_entreprise
      }
    });
  }

  console.log('✅ Rôles initialisés avec succès !');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
