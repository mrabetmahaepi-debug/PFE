import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function testStats() {
  try {
    const [totalEnterprises, totalAdmins, totalProjects, pendingApprovals] = await Promise.all([
      prisma.entreprise.count().catch(err => {
        console.error("Error counting enterprises:", err.message);
        return 0;
      }),
      prisma.utilisateur.count({
        where: {
          role: { nom: { in: ["Admin", "ADMIN", "admin"] } }
        }
      }).catch(err => {
        console.error("Error counting admins:", err.message);
        return 0;
      }),
      prisma.projet.count().catch(err => {
        console.error("Error counting projects:", err.message);
        return 0;
      }),
      prisma.utilisateur.count({
        where: { statut: "PENDING" }
      }).catch(err => {
        console.error("Error counting pending users:", err.message);
        return 0;
      })
    ]);
    console.log({ totalEnterprises, totalAdmins, totalProjects, pendingApprovals });
  } catch (e) {
    console.error("Fatal:", e);
  }
}
testStats().finally(() => prisma.$disconnect());
