import prisma from "../prisma/prismaClient";

export interface Badge {
  nom: string;
  description: string;
}

export const getMyBadges = async (userId: number): Promise<Badge[]> => {
  const completedTasks = await prisma.tache.count({
    where: {
      assigne_a: userId,
      statut_t: "terminee",
    },
  });

  const badges: Badge[] = [];

  if (completedTasks >= 1) {
    badges.push({
      nom: "Premier Pas",
      description: "Vous avez terminé votre première tâche",
    });
  }

  if (completedTasks >= 5) {
    badges.push({
      nom: "Débutant",
      description: "Vous avez terminé 5 tâches",
    });
  }

  if (completedTasks >= 10) {
    badges.push({
      nom: "Expert",
      description: "Vous avez terminé 10 tâches",
    });
  }

  if (completedTasks >= 20) {
    badges.push({
      nom: "Maître de Productivité",
      description: "Vous avez terminé 20 tâches",
    });
  }

  return badges;
};