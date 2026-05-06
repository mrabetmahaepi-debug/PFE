const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const counts = await Promise.all([
      prisma.entreprise.count(),
      prisma.utilisateur.count(),
      prisma.projet.count()
    ]);
    console.log("Counts:", {
      enterprises: counts[0],
      users: counts[1],
      projects: counts[2]
    });
  } catch (err) {
    console.error("DEBUG ERROR:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
