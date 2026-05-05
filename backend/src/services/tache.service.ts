import prisma from "../prisma/prismaClient";


const STATUTS_VALIDES = ["todo", "en_cours", "terminee"] as const;
const PRIORITES_VALIDES = ["basse", "moyenne", "haute", "critique"] as const;

const verifierStatut = (statut?: string) => {
  if (statut && !STATUTS_VALIDES.includes(statut as any)) {
    throw new Error("Statut invalide");
  }
};

const verifierPriorite = (priorite?: string) => {
  if (priorite && !PRIORITES_VALIDES.includes(priorite as any)) {
    throw new Error("Priorité invalide");
  }
};
interface CreateTaskData {
  nom_t: string;
  description_t?: string;
  date_limite_t?: string;
  priorite_t?: string;
  statut_t?: string;
  id_projet: number;
  id_sprint?: number;
}

interface UpdateTaskData {
  nom_t?: string;
  description_t?: string;
  date_limite_t?: string;
  priorite_t?: string;
  statut_t?: string;
  id_projet?: number;
  id_sprint?: number | null;
  assigne_a?: number | null;
}

export const createTaskService = async (data: CreateTaskData) => {
  const {
    nom_t,
    description_t,
    date_limite_t,
    priorite_t,
    id_projet,
    statut_t,
    id_sprint
  } = data;

  verifierPriorite(priorite_t);
  verifierStatut(statut_t);
  if (!nom_t || !id_projet) {
    throw new Error("nom_t et id_projet sont obligatoires");
  }

  const projet = await prisma.projet.findUnique({
    where: { id_projet: Number(id_projet) }
  });

  if (!projet) {
    throw new Error("Projet inexistant");
  }

  if (id_sprint) {
    const sprint = await prisma.sprint.findUnique({
      where: { id_sprint: Number(id_sprint) }
    });

    if (!sprint) {
      throw new Error("Sprint inexistant");
    }

    if (sprint.id_projet !== Number(id_projet)) {
      throw new Error("Le sprint n'appartient pas à ce projet");
    }
  }

  const task = await prisma.tache.create({
    data: {
      nom_t,
      description_t,
      date_limite_t: date_limite_t ? new Date(date_limite_t) : null,
      priorite_t: priorite_t || "moyenne",
      statut_t: statut_t || "todo",
      id_projet: Number(id_projet),
      id_sprint: id_sprint ? Number(id_sprint) : null
    },

    include: {
      utilisateur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          poste: true
        }
      },
      projet: true,
      sprint: true
    }
  });

  return task;
};

export const getAllTasksService = async () => {
  return await prisma.tache.findMany({
    include: {
      utilisateur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          poste: true
        }
      },
      projet: true,
      sprint: true
    }
  });
};

export const getTaskByIdService = async (id: number) => {
  const task = await prisma.tache.findUnique({
    where: { id_tache: id },
    include: {
      utilisateur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          poste: true
        }
      },
      projet: true,
      sprint: true
    }
  });

  if (!task) {
    throw new Error("Tâche inexistante");
  }

  return task;
};

export const updateTaskService = async (id: number, data: UpdateTaskData) => {
  const existingTask = await prisma.tache.findUnique({
    where: { id_tache: id }
  });
  verifierStatut(data.statut_t);
  verifierPriorite(data.priorite_t);

  if (!existingTask) {
    throw new Error("Tâche inexistante");
  }

  if (data.id_projet) {
    const projet = await prisma.projet.findUnique({
      where: { id_projet: Number(data.id_projet) }
    });

    if (!projet) {
      throw new Error("Projet inexistant");
    }
  }

  if (data.id_sprint) {
    const sprint = await prisma.sprint.findUnique({
      where: { id_sprint: Number(data.id_sprint) }
    });

    if (!sprint) {
      throw new Error("Sprint inexistant");
    }

    const projetId = data.id_projet ?? existingTask.id_projet;

    if (sprint.id_projet !== projetId) {
      throw new Error("Le sprint n'appartient pas à ce projet");
    }
  }

  const task = await prisma.tache.update({
    where: { id_tache: id },
    data: {
      ...data,
      date_limite_t: data.date_limite_t ? new Date(data.date_limite_t) : undefined,
      id_projet: data.id_projet ? Number(data.id_projet) : undefined,
      id_sprint:
        data.id_sprint === null
          ? null
          : data.id_sprint
            ? Number(data.id_sprint)
            : undefined,
      assigne_a:
        data.assigne_a === null
          ? null
          : data.assigne_a
            ? Number(data.assigne_a)
            : undefined
    },
    include: {
      utilisateur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          poste: true
        }
      },
      projet: true,
      sprint: true
    }
  });

  return task;
};

export const deleteTaskService = async (id: number) => {
  const existingTask = await prisma.tache.findUnique({
    where: { id_tache: id }
  });

  if (!existingTask) {
    throw new Error("Tâche inexistante");
  }

  await prisma.tache.delete({
    where: { id_tache: id }
  });

  return true;
};
export const assignTaskService = async (id_tache: number, id_utilisateur: number) => {
  const task = await prisma.tache.findUnique({
    where: { id_tache },
    include: {
      projet: true,
      sprint: true,
      utilisateur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          poste: true
        }
      }
    }
  });

  if (!task) {
    throw new Error("Tâche inexistante");
  }

  if (!task.id_projet) {
    throw new Error("Cette tâche n'est liée à aucun projet");
  }

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id_utilisateur: Number(id_utilisateur) }
  });

  if (!utilisateur) {
    throw new Error("Utilisateur inexistant");
  }

  const membreProjet = await prisma.affectation.findFirst({
    where: {
      id_projet: task.id_projet,
      id_utilisateur: Number(id_utilisateur),
      role_affectation: { in: ["membre", "chef"] },
    },
  });

  if (!membreProjet) {
    throw new Error("L'utilisateur n'est pas membre de ce projet");
  }

  const taskUpdated = await prisma.tache.update({
    where: { id_tache },
    data: {
      assigne_a: Number(id_utilisateur)
    },
    include: {
      utilisateur: true,
      projet: true,
      sprint: true
    }
  });

  await prisma.affectation.create({
    data: {
      id_utilisateur: Number(id_utilisateur),
      id_projet: task.id_projet,
      id_tache: task.id_tache,
      role_affectation: "ASSIGNE"
    }
  });

  return taskUpdated;
};
export const getTasksByProjectService = async (id_projet: number) => {
  const projet = await prisma.projet.findUnique({
    where: { id_projet }
  });

  if (!projet) {
    throw new Error("Projet inexistant");
  }

  return await prisma.tache.findMany({
    where: { id_projet },
    include: {
      utilisateur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          poste: true
        }
      },
      projet: true,
      sprint: true
    },
    orderBy: {
      id_tache: "desc"
    }
  });
};
export const getTasksBySprintService = async (id_sprint: number) => {
  const sprint = await prisma.sprint.findUnique({
    where: { id_sprint }
  });

  if (!sprint) {
    throw new Error("Sprint inexistant");
  }

  return await prisma.tache.findMany({
    where: { id_sprint },
    include: {
      utilisateur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          poste: true
        }
      },
      projet: true,
      sprint: true
    },
    orderBy: {
      id_tache: "desc"
    }
  });
};
export const getMyTasksService = async (userId: number) => {
  return await prisma.tache.findMany({
    where: {
      assigne_a: userId
    },
    include: {
      utilisateur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          poste: true
        }
      },
      projet: true,
      sprint: true
    },
    orderBy: {
      id_tache: "desc"
    }
  });
};
export const updateMyTaskStatusService = async (
  id_tache: number,
  userId: number,
  statut_t: string
) => {
  const statutsValides = ["todo", "en_cours", "terminee"];

  if (!statutsValides.includes(statut_t)) {
    throw new Error("Statut invalide");
  }

  const task = await prisma.tache.findUnique({
    where: { id_tache }
  });

  if (!task) {
    throw new Error("Tâche inexistante");
  }

  if (task.assigne_a !== userId) {
    throw new Error("Cette tâche ne vous est pas assignée");
  }

  const updatedTask = await prisma.tache.update({
    where: { id_tache },
    data: {
      statut_t,
      date_fin_t: statut_t === "terminee" ? new Date() : null
    },
    include: {
      utilisateur: {
        select: {
          id_utilisateur: true,
          nom: true,
          prenom: true,
          email: true,
          poste: true
        }
      },
      projet: true,
      sprint: true
    }
  });

  return updatedTask;
};


export const getProjectProgress = async (projectId: number) => {
  const projet = await prisma.projet.findUnique({ where: { id_projet: projectId } });
  if (!projet) throw new Error("Projet inexistant");

  const total = await prisma.tache.count({ where: { id_projet: projectId } });
  const done = await prisma.tache.count({ where: { id_projet: projectId, statut_t: "terminee" } });
  const inProgress = await prisma.tache.count({ where: { id_projet: projectId, statut_t: "en_cours" } });
  const todo = await prisma.tache.count({ where: { id_projet: projectId, statut_t: "todo" } });

  return {
    id_projet: projectId,
    nom_p: projet.nom_p,
    total,
    done,
    inProgress,
    todo,
    progressPercent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
};

export const getUserProgress = async (userId: number) => {
  const utilisateur = await prisma.utilisateur.findUnique({ where: { id_utilisateur: userId } });
  if (!utilisateur) throw new Error("Utilisateur inexistant");

  const total = await prisma.tache.count({ where: { assigne_a: userId } });
  const done = await prisma.tache.count({ where: { assigne_a: userId, statut_t: "terminee" } });
  const inProgress = await prisma.tache.count({ where: { assigne_a: userId, statut_t: "en_cours" } });
  const todo = await prisma.tache.count({ where: { assigne_a: userId, statut_t: "todo" } });

  return {
    id_utilisateur: userId,
    nom: utilisateur.nom,
    prenom: utilisateur.prenom,
    total,
    done,
    inProgress,
    todo,
    progressPercent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
};

export const getSprintProgress = async (sprintId: number) => {
  const sprint = await prisma.sprint.findUnique({ where: { id_sprint: sprintId } });
  if (!sprint) throw new Error("Sprint inexistant");

  const total = await prisma.tache.count({ where: { id_sprint: sprintId } });
  const done = await prisma.tache.count({ where: { id_sprint: sprintId, statut_t: "terminee" } });
  const inProgress = await prisma.tache.count({ where: { id_sprint: sprintId, statut_t: "en_cours" } });
  const todo = await prisma.tache.count({ where: { id_sprint: sprintId, statut_t: "todo" } });

  return {
    id_sprint: sprintId,
    nom_s: sprint.nom_s,
    total,
    done,
    inProgress,
    todo,
    progressPercent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
};
