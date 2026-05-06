import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const enterprises = await prisma.entreprise.count();
  const users = await prisma.utilisateur.count();
  const projects = await prisma.projet.count();
  console.log({ enterprises, users, projects });
}
main().catch(console.error).finally(() => prisma.$disconnect());
