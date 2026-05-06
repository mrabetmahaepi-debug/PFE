import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const activeUsers = await prisma.utilisateur.findMany({
    where: { 
      lastLogin: { gte: last7Days },
      NOT: { role: { nom: 'SuperAdmin' } }
    },
    select: { id_utilisateur: true, email: true, lastLogin: true, role: { select: { nom: true } } }
  });
  
  console.log("Found active users:", activeUsers.length);
  console.log(JSON.stringify(activeUsers, null, 2));
  console.log("Comparison date:", last7Days.toISOString());
}

main().catch(console.error).finally(() => prisma.$disconnect());
