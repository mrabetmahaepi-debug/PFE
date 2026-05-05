import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.entreprise.findFirst().then(console.log).finally(() => prisma.$disconnect());
