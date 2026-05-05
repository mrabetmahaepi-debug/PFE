import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.utilisateur.findFirst().then(console.log).finally(() => prisma.$disconnect());
