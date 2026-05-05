import prisma from '../src/prisma/prismaClient';

(async () => {
  try {
    const users = await prisma.utilisateur.findMany({ where: { statut: 'PENDING' } });
    const invitations = await prisma.invitation.findMany();
    const notifications = await prisma.notification.findMany({ where: { type: { in: ['warning', 'info', 'success', 'danger'] } }, take: 50 });
    console.log('pending users:', users.length);
    console.log(users.map(u => ({ id_utilisateur: u.id_utilisateur, email: u.email, statut: u.statut, id_role: u.id_role })));
    console.log('invitations:', invitations.length);
    console.log(invitations.map(i => ({ id_invitation: i.id_invitation, email: i.email, id_role: i.id_role, id_entreprise: i.id_entreprise })));
    console.log('notifications:', notifications.length);
    console.log(notifications.map(n => ({ id: n.num_notification, sujet: n.sujet, message: n.message, type: n.type, user: n.id_utilisateur })));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();
