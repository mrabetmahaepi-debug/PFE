/**
 * Script d'initialisation du groupe "Réunion Admins".
 * Crée le groupe et y ajoute tous les Admins et SuperAdmin actifs.
 * 
 * Usage: npx ts-node src/scripts/init_admin_meeting_group.ts
 */
import { MessagingService } from '../services/messaging.service';
import { PrismaClient } from '@prisma/client';

// Use a local instance to get fresh types
const localPrisma = new PrismaClient();

async function main() {
  console.log('🚀 Initialisation du groupe "Réunion Admins"...');

  try {
    const group = await MessagingService.initAdminMeetingGroup();
    if (!group) throw new Error('Échec de la création du groupe.');

    const participants = await localPrisma.participant.findMany({
      where: { id_conversation: group.id_conversation },
      include: {
        utilisateur: {
          select: { nom: true, prenom: true, email: true }
        }
      }
    });

    console.log(`\n✅ Groupe créé/mis à jour: "${group.nom}" (ID: ${group.id_conversation})`);
    console.log(`👥 ${participants.length} participant(s) ajouté(s):\n`);

    for (const p of participants) {
      const u = p.utilisateur;
      console.log(`   - ${u.prenom ?? ''} ${u.nom ?? ''} <${u.email}>`);
    }

    console.log('\n🎉 Initialisation terminée avec succès!');
  } catch (err) {
    console.error('\n❌ Erreur:', err);
  } finally {
    await localPrisma.$disconnect();
  }
}

main();
