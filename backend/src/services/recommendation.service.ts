import prisma from "../prisma/prismaClient";

export const getRecommendedProjectManagers = async (projectId: number) => {
  const users = await prisma.utilisateur.findMany({
    include: {
      membre_projet: true,
      tache: true,
    },
  });

  const results = users.map((user: any) => {
    let score = 0;
    const reasons: string[] = [];

    const poste = (user.poste || "").toLowerCase();

    if (poste.includes("chef")) {
      score += 40;
      reasons.push("poste chef de projet");
    }

    if (poste.includes("manager")) {
      score += 30;
      reasons.push("poste management");
    }

    if (poste.includes("project")) {
      score += 20;
      reasons.push("poste projet");
    }

    if (user.id_role === 3) {
      score += 30;
      reasons.push("rôle chef de projet");
    }

    const projectsCount = user.membre_projet.length;
    if (projectsCount > 0) {
      score += projectsCount * 5;
      reasons.push(`${projectsCount} projets`);
    }

    const completedTasks = user.tache.filter((t: any) => {
      return t.statut_t?.toLowerCase() === "terminee";
    }).length;

    if (completedTasks > 0) {
      score += completedTasks * 2;
      reasons.push(`${completedTasks} tâches terminées`);
    }

    return {
      id_utilisateur: user.id_utilisateur,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      poste: user.poste,
      score,
      raison: reasons.join(", "),
    };
  });

  return results.sort((a: any, b: any) => b.score - a.score).slice(0, 5);
};