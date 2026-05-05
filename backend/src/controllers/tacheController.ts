import { Request, Response } from "express";
import {
  createTaskService,
  getAllTasksService,
  getTaskByIdService,
  updateTaskService,
  deleteTaskService,
  assignTaskService,
  getTasksByProjectService,
  getTasksBySprintService,
  getMyTasksService,
  updateMyTaskStatusService,
  getProjectProgress,
  getUserProgress,
  getSprintProgress,
} from "../services/tache.service";


export const createTask = async (req: Request, res: Response) => {
  try {
    const task = await createTaskService(req.body);
    return res.status(201).json({ message: "Tâche créée", task });
  } catch (error: any) {
    const status =
      ["Projet inexistant", "Sprint inexistant", "Le sprint n'appartient pas à ce projet"].includes(error.message)
        ? 400
        : 500;
    return res.status(status).json({ message: error.message });
  }
};

export const getAllTasks = async (_req: Request, res: Response) => {
  try {
    const tasks = await getAllTasksService();
    return res.status(200).json(tasks);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getTaskById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    const task = await getTaskByIdService(id);
    return res.status(200).json(task);
  } catch (error: any) {
    return res.status(error.message === "Tâche inexistante" ? 404 : 500).json({ message: error.message });
  }
};

export const updateTask = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    const task = await updateTaskService(id, req.body);
    return res.status(200).json({ message: "Tâche mise à jour", task });
  } catch (error: any) {
    const status =
      error.message === "Tâche inexistante"
        ? 404
        : ["Projet inexistant", "Sprint inexistant", "Le sprint n'appartient pas à ce projet"].includes(error.message)
          ? 400
          : 500;
    return res.status(status).json({ message: error.message });
  }
};

export const deleteTask = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    await deleteTaskService(id);
    return res.status(200).json({ message: "Tâche supprimée" });
  } catch (error: any) {
    return res.status(error.message === "Tâche inexistante" ? 404 : 500).json({ message: error.message });
  }
};

export const assignTask = async (req: Request, res: Response) => {
  try {
    const id_tache = parseInt(req.params.id as string);
    const { id_utilisateur } = req.body;

    if (isNaN(id_tache)) return res.status(400).json({ message: "ID tâche invalide" });
    if (!id_utilisateur) return res.status(400).json({ message: "id_utilisateur est obligatoire" });

    const task = await assignTaskService(id_tache, Number(id_utilisateur));
    return res.status(200).json({ message: "Tâche assignée avec succès", task });
  } catch (error: any) {
    const status =
      error.message === "Tâche inexistante"
        ? 404
        : ["Utilisateur inexistant", "L'utilisateur n'est pas membre de ce projet", "Cette tâche n'est liée à aucun projet"].includes(error.message)
          ? 400
          : 500;
    return res.status(status).json({ message: error.message });
  }
};

export const getTasksByProject = async (req: Request, res: Response) => {
  try {
    const id_projet = parseInt(req.params.id_projet as string);
    if (isNaN(id_projet)) return res.status(400).json({ message: "ID projet invalide" });

    const tasks = await getTasksByProjectService(id_projet);
    return res.status(200).json(tasks);
  } catch (error: any) {
    return res.status(error.message === "Projet inexistant" ? 404 : 500).json({ message: error.message });
  }
};

export const getTasksBySprint = async (req: Request, res: Response) => {
  try {
    const id_sprint = parseInt(req.params.id_sprint as string);
    if (isNaN(id_sprint)) return res.status(400).json({ message: "ID sprint invalide" });

    const tasks = await getTasksBySprintService(id_sprint);
    return res.status(200).json(tasks);
  } catch (error: any) {
    return res.status(error.message === "Sprint inexistant" ? 404 : 500).json({ message: error.message });
  }
};

export const getMyTasks = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const tasks = await getMyTasksService(userId);
    return res.status(200).json(tasks);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateMyTaskStatus = async (req: any, res: Response) => {
  try {
    const id_tache = parseInt(req.params.id as string);
    const { statut_t } = req.body;
    const userId = req.user.id;

    if (isNaN(id_tache)) return res.status(400).json({ message: "ID tâche invalide" });
    if (!statut_t) return res.status(400).json({ message: "statut_t est obligatoire" });

    const task = await updateMyTaskStatusService(id_tache, userId, statut_t);
    return res.status(200).json({ message: "Statut de la tâche mis à jour", task });
  } catch (error: any) {
    const status =
      error.message === "Tâche inexistante"
        ? 404
        : ["Statut invalide", "Cette tâche ne vous est pas assignée"].includes(error.message)
          ? 400
          : 500;
    return res.status(status).json({ message: error.message });
  }
};


export const getProjectProgressController = async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId) || projectId <= 0)
      return res.status(400).json({ message: "projectId invalide" });

    const result = await getProjectProgress(projectId);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ message: "Erreur lors du calcul de l'avancement du projet", error: error.message });
  }
};

export const getUserProgressController = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    if (isNaN(userId) || userId <= 0)
      return res.status(400).json({ message: "userId invalide" });

    const result = await getUserProgress(userId);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ message: "Erreur lors du calcul de l'avancement utilisateur", error: error.message });
  }
};

export const getSprintProgressController = async (req: Request, res: Response) => {
  try {
    const sprintId = Number(req.params.sprintId);
    if (isNaN(sprintId) || sprintId <= 0)
      return res.status(400).json({ message: "sprintId invalide" });

    const result = await getSprintProgress(sprintId);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ message: "Erreur lors du calcul de l'avancement du sprint", error: error.message });
  }
};