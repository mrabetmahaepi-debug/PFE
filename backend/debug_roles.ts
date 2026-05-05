import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany();
  console.log('Roles in DB:', JSON.stringify(roles, null, 2));
  
  const admins = await prisma.utilisateur.findMany({
    include: { role: true }
  });
  console.log('Users and Roles:', JSON.stringify(admins.map(u => ({ email: u.email, role: u.role?.nom })), null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
