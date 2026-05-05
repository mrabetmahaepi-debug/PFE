import prisma from '../prisma/prismaClient';

async function fixAdmins() {
  console.log('Fixing admins with no enterprise...');
  
  // Get the first enterprise to use as default (if none, we should created one)
  let defaultEnterprise = await prisma.entreprise.findFirst();
  
  if (!defaultEnterprise) {
    console.log('No enterprise found. Creating a default one...');
    defaultEnterprise = await prisma.entreprise.create({
      data: {
        nom: 'Default Enterprise',
        adresse: 'System'
      }
    });
  }

  const result = await prisma.utilisateur.updateMany({
    where: {
      id_entreprise: null,
      // We can target specific roles if we want, but the request says EACH Admin.
      // Usually users in PENDING or ACTIVE status without enterprise are those we want to fix.
    },
    data: {
      id_entreprise: defaultEnterprise.id_entreprise
    }
  });

  console.log(`Updated ${result.count} users.`);
}

fixAdmins()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
