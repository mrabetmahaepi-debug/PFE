import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const allUsers = await prisma.utilisateur.findMany({
    include: { role: true }
  });

  console.log("=== ALL USERS IN DB ===");
  allUsers.forEach(u => {
    const roleName = u.role?.nom;
    const isRecent = u.lastLogin && new Date(u.lastLogin) >= sevenDaysAgo;
    const isAdmin = roleName && ['Admin', 'ADMIN', 'admin'].includes(roleName);
    const isActiveAdmin = isRecent && isAdmin;
    
    console.log(`Email: ${u.email}`);
    console.log(`  lastLogin: ${u.lastLogin}`);
    console.log(`  Role: ${roleName}`);
    console.log(`  Statut: ${u.statut}`);
    console.log(`  Is Recent: ${isRecent}`);
    console.log(`  Is Admin: ${isAdmin}`);
    console.log(`  IS ACTIVE ADMIN: ${isActiveAdmin}`);
    console.log("-------------------");
  });

  const activeCount = allUsers.filter(u => {
    const roleName = u.role?.nom;
    return u.lastLogin && new Date(u.lastLogin) >= sevenDaysAgo && roleName && ['Admin', 'ADMIN', 'admin'].includes(roleName);
  }).length;

  console.log("FINAL COUNT:", activeCount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
