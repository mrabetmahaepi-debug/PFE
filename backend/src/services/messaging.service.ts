import prisma from "../prisma/prismaClient";

export class MessagingService {
  private static ADMIN_GROUP_NAME = "Réunion Admins";

  /**
   * Initialise le groupe de réunion des admins s'il n'existe pas.
   * Ajoute le SuperAdmin et tous les Admins existants.
   */
  static async initAdminMeetingGroup() {
    try {
      // 1. Trouver ou créer la conversation système
      let conversation = await prisma.conversation.findFirst({
        where: { nom: this.ADMIN_GROUP_NAME, is_system: true }
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            nom: this.ADMIN_GROUP_NAME,
            is_group: true,
            is_system: true
          }
        });
        console.log(`[Messaging] Groupe "${this.ADMIN_GROUP_NAME}" créé.`);

        // 2. Trouver tous les utilisateurs éligibles (SuperAdmin + Admins)
        const eligibleUsers = await prisma.utilisateur.findMany({
          where: {
            OR: [
              { role: { nom: { in: ["SuperAdmin", "SUPERADMIN", "superadmin"] } } },
              { role: { nom: { in: ["Admin", "ADMIN", "admin"] } } }
            ],
            statut: "ACTIVE"
          }
        });

        // 3. Ajouter tous les participants éligibles
        for (const user of eligibleUsers) {
          await prisma.participant.upsert({
            where: {
              id_utilisateur_id_conversation: {
                id_utilisateur: user.id_utilisateur,
                id_conversation: conversation.id_conversation
              }
            },
            update: {},
            create: {
              id_utilisateur: user.id_utilisateur,
              id_conversation: conversation.id_conversation,
              isAdmin: true
            }
          });
        }
      }

      return conversation;
    } catch (error) {
      console.error("[Messaging] Erreur initAdminMeetingGroup:", error);
      return null;
    }
  }

  /**
   * Ajoute un utilisateur spécifique au groupe Admin Meeting s'il a le bon rôle.
   * Crée le groupe automatiquement s'il n'existe pas encore.
   */
  static async addUserToAdminMeetingGroup(userId: number) {
    try {
      // 1. Récupérer l'utilisateur avec son rôle
      const user = await prisma.utilisateur.findUnique({
        where: { id_utilisateur: userId },
        include: { role: true }
      });

      if (!user || !user.role) {
        console.log(`[Messaging] Utilisateur ${userId} non trouvé ou sans rôle.`);
        return;
      }

      const roleNom = user.role.nom?.toLowerCase();
      const isEligible = roleNom === "admin" || roleNom === "superadmin";

      if (!isEligible) {
        console.log(`[Messaging] Utilisateur ${userId} n'est pas un admin (rôle: ${user.role.nom}).`);
        return;
      }

      // 2. Garantir que le groupe existe (le crée si absent + ajoute tous les admins)
      let conversation = await prisma.conversation.findFirst({
        where: { nom: this.ADMIN_GROUP_NAME, is_system: true }
      });

      if (!conversation) {
        conversation = await this.initAdminMeetingGroup();
      }

      if (!conversation) {
        console.error("[Messaging] Impossible de trouver ou créer le groupe Réunion Admins.");
        return;
      }

      // 3. Ajouter l'utilisateur s'il n'est pas déjà présent (unique check via upsert)
      await prisma.participant.upsert({
        where: {
          id_utilisateur_id_conversation: {
            id_utilisateur: user.id_utilisateur,
            id_conversation: conversation.id_conversation
          }
        },
        update: {},
        create: {
          id_utilisateur: user.id_utilisateur,
          id_conversation: conversation.id_conversation,
          isAdmin: true
        }
      });

      console.log("Admin ajouté à Réunion Admins");
    } catch (error) {
      console.error("[Messaging] Erreur addUserToAdminMeetingGroup:", error);
    }
  }
}
