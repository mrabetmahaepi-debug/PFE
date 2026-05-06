import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    "ALTER TABLE utilisateur ADD COLUMN photoUrl VARCHAR(500) NULL"
  );
  console.log("✅ photoUrl column added successfully");
}

main()
  .catch(e => {
    if (e.message.includes('Duplicate column')) {
      console.log("ℹ️ photoUrl column already exists");
    } else {
      console.error("❌ Error:", e.message);
    }
  })
  .finally(() => prisma.$disconnect());
