import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const activities = await (prisma as any).activity.findMany();
  console.log("Activities in DB:", activities);
}
main().catch(console.error).finally(() => prisma.$disconnect());
