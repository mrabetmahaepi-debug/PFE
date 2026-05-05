import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.role.findFirst({where: {id_role: 1}}).then(console.log).finally(() => prisma.$disconnect());
