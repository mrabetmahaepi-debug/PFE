import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.utilisateur.findMany({ include: { role: true } }).then(users => console.log(users.length)).finally(() => prisma.$disconnect());
