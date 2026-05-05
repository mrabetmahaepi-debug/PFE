import prisma from "../prisma/prismaClient";

export const checkOverdueTasks = async () => {
  const now = new Date();
  
  // 1. Trouver les tâches en retard (date_limite_t < now et statut != DONE)
  const overdueTasks = await prisma.tache.findMany({
    where: {
      date_limite_t: { lt: now },
      statut_t: { not: "DONE" }
    },
    include: {
      utilisateur: true, // L'assigné
      projet: {
        include: {
          affectation: {
            where: { role_affectation: "chef" },
            include: { utilisateur: true }
          }
        }
      }
    }
  });

  let alertsCreated = 0;

  for (const task of overdueTasks) {
    // Vérifier si une alerte existe déjà pour éviter les doublons
    const existingAlert = await prisma.notification.findFirst({
      where: {
        id_utilisateur: task.assigne_a || 0,
        sujet: "Retard sur tâche",
        message: { contains: task.nom_t || "" }
      }
    });

    if (!existingAlert && task.assigne_a) {
      // Alerte pour le Membre
      await prisma.notification.create({
        data: {
          id_utilisateur: task.assigne_a,
          sujet: "Retard sur tâche",
          message: `La tâche "${task.nom_t}" est en retard. Date prévue : ${task.date_limite_t?.toLocaleDateString()}`,
          type: "danger",
          date_envoi: new Date()
        }
      });

      // Alerte pour le Chef de Projet
      const chefs = task.projet?.affectation || [];
      for (const chef of chefs) {
        await prisma.notification.create({
          data: {
            id_utilisateur: chef.id_utilisateur,
            sujet: "Alerte Retard Équipe",
            message: `L'utilisateur ${task.utilisateur?.prenom} est en retard sur la tâche "${task.nom_t}" (Projet: ${task.projet?.nom_p})`,
            type: "warning",
            date_envoi: new Date()
          }
        });
      }
      
      alertsCreated++;
    }
  }

  return alertsCreated;
};
