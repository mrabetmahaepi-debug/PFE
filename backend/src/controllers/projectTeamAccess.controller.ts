import { Request, Response } from "express";
import {
  getMyManagedProjects,
  getProjectEquipeSnapshot,
  saveProjectMemberEquipe,
  addProjectMemberEquipe,
} from "../services/projectTeamAccess.service";

export async function getMyManagedProjectsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = (req as any).user;
    const projects = await getMyManagedProjects(user);
    res.json({ projects });
  } catch (error) {
    console.error("[getMyManagedProjects]", error);
    res.status(500).json({ message: "Erreur chargement projets gérés" });
  }
}

export async function getProjectEquipeController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const projectId = Number(req.params.id);
    if (!Number.isFinite(projectId) || projectId < 1) {
      res.status(400).json({ message: "ID projet invalide" });
      return;
    }
    const user = (req as any).user;
    const snapshot = await getProjectEquipeSnapshot(user, projectId);
    res.json(snapshot);
  } catch (error: any) {
    console.error("[getProjectEquipe]", error);
    res.status(error?.status ?? 500).json({
      message: error?.message ?? "Erreur chargement équipe",
    });
  }
}

export async function saveProjectMemberEquipeController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const projectId = Number(req.params.id);
    const memberUserId = Number(req.params.userId);
    if (
      !Number.isFinite(projectId) ||
      projectId < 1 ||
      !Number.isFinite(memberUserId) ||
      memberUserId < 1
    ) {
      res.status(400).json({ message: "Identifiants invalides" });
      return;
    }
    const user = (req as any).user;
    const { roleProjet, permissions, sprints, lists, tasks } = req.body ?? {};
    await saveProjectMemberEquipe(user, projectId, memberUserId, {
      roleProjet,
      permissions: Array.isArray(permissions) ? permissions : [],
      sprints: Array.isArray(sprints) ? sprints : [],
      lists: Array.isArray(lists) ? lists : [],
      tasks: Array.isArray(tasks) ? tasks : [],
    });
    const snapshot = await getProjectEquipeSnapshot(user, projectId);
    res.json(snapshot);
  } catch (error: any) {
    console.error("[saveProjectMemberEquipe]", error);
    res.status(error?.status ?? 500).json({
      message: error?.message ?? "Erreur enregistrement équipe",
    });
  }
}

export async function addProjectMemberEquipeController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const projectId = Number(req.params.id);
    if (!Number.isFinite(projectId) || projectId < 1) {
      res.status(400).json({ message: "ID projet invalide" });
      return;
    }
    const user = (req as any).user;
    const { userId, profilePoste } = req.body ?? {};
    const memberUserId = Number(userId);
    if (!Number.isFinite(memberUserId) || memberUserId < 1) {
      res.status(400).json({ message: "Utilisateur invalide" });
      return;
    }
    if (!profilePoste || !String(profilePoste).trim()) {
      res.status(400).json({ message: "Profil de permissions requis" });
      return;
    }
    await addProjectMemberEquipe(user, projectId, {
      userId: memberUserId,
      profilePoste: String(profilePoste),
    });
    const snapshot = await getProjectEquipeSnapshot(user, projectId);
    res.status(201).json(snapshot);
  } catch (error: any) {
    console.error("[addProjectMemberEquipe]", error);
    res.status(error?.status ?? 500).json({
      message: error?.message ?? "Erreur ajout membre",
    });
  }
}
