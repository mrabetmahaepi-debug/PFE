const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$executeRawUnsafe('ALTER TABLE utilisateur ADD COLUMN lastLogin DATETIME DEFAULT NULL;')
  .then(()=>console.log('Done'))
  .catch((e)=>console.error('Error:', e))
  .finally(()=>prisma.$disconnect());
