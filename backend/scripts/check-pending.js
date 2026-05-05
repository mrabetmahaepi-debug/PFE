import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPendingData() {
  try {
    console.log('🔍 Checking pending users...');
    const pendingUsers = await prisma.utilisateur.findMany({
      where: { statut: 'PENDING' },
      include: { role: true }
    });
    console.log(`Found ${pendingUsers.length} pending users:`, pendingUsers);

    console.log('\n🔍 Checking invitations...');
    const invitations = await prisma.invitation.findMany();
    console.log(`Found ${invitations.length} invitations:`, invitations);

    console.log('\n🔍 Checking all users...');
    const allUsers = await prisma.utilisateur.findMany({
      include: { role: true }
    });
    console.log(`Found ${allUsers.length} total users:`, allUsers.map(u => ({
      id: u.id_utilisateur,
      email: u.email,
      role: u.role?.nom,
      statut: u.statut
    })));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPendingData();