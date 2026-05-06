import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const enterprises = await prisma.entreprise.findMany({
    select: {
      nom: true,
      createdAt: true
    }
  });
  console.log(JSON.stringify(enterprises, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
