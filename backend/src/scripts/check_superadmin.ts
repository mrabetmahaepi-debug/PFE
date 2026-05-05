import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking SuperAdmin account...');
  try {
    const user = await prisma.utilisateur.findFirst({
      where: {
        OR: [
          { email: 'superadmin@gp.com' },
          { role: { nom: 'SuperAdmin' } }
        ]
      },
      include: { role: true }
    });

    if (!user) {
      console.log('❌ SuperAdmin not found. Creating it...');
      // Create SuperAdmin logic here if needed
    } else {
      console.log('✅ Found user:', user.email);
      console.log('Status:', user.statut);
      console.log('Role:', user.role?.nom);
      
      const isPasswordCorrect = await bcrypt.compare('superadmin123', user.password || '');
      console.log('Password "superadmin123" is correct:', isPasswordCorrect);
      
      if (user.statut !== 'ACTIVE' || !isPasswordCorrect) {
        console.log('⚠️ User exists but has issues. Fixing...');
        const hashedPassword = await bcrypt.hash('superadmin123', 10);
        await prisma.utilisateur.update({
          where: { id_utilisateur: user.id_utilisateur },
          data: {
            statut: 'ACTIVE',
            password: hashedPassword
          }
        });
        console.log('✅ User updated to ACTIVE and password reset to superadmin123');
      }
    }
  } catch (error: any) {
    console.error('❌ Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
