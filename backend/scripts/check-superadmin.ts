import prisma from '../src/prisma/prismaClient';

(async () => {
  try {
    const superAdmin = await prisma.utilisateur.findFirst({
      where: { role: { nom: 'SuperAdmin' } },
      include: { role: true }
    });
    console.log('superAdmin:', superAdmin ? { id: superAdmin.id_utilisateur, email: superAdmin.email, role: superAdmin.role?.nom } : null);

    const invitations = await prisma.invitation.findMany();
    console.log('invitations count:', invitations.length);

    const pending = await prisma.utilisateur.findMany({ where: { statut: 'PENDING' } });
    console.log('pending users count:', pending.length);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();
