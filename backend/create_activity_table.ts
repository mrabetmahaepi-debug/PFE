import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS activity (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user VARCHAR(100) NOT NULL,
      action VARCHAR(255) NOT NULL,
      entreprise VARCHAR(100),
      status VARCHAR(50) DEFAULT 'ACTIVE',
      type VARCHAR(50) DEFAULT 'info',
      entityId INT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Table activity created');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
