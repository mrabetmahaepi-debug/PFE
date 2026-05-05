import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.projet.findFirst().then(console.log).finally(() => prisma.$disconnect());
