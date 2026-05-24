import type { Request, RequestHandler } from "express";
import prisma from "../prisma/prismaClient";
import {
  getProjectIdForList,
  requestCanWriteLists,
} from "../services/projectPermission.service";

export type ListProjectIdResolver = (
  req: Request
) => Promise<number | null | undefined>;

/**
 * Allows list mutations when the user has global LIST_MANAGE or project-scoped
 * create_tasks / create_sprints / manage_sprints on the target project.
 */
export function requireListWrite(
  resolveProjectId: ListProjectIdResolver
): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ message: "Utilisateur non authentifié" });
      }
      const raw = await resolveProjectId(req);
      const projectId = raw == null ? NaN : Number(raw);
      if (!Number.isFinite(projectId) || projectId < 1) {
        return res.status(400).json({ message: "Identifiant de projet invalide" });
      }
      const allowed = await requestCanWriteLists(req, projectId);
      if (!allowed) {
        return res.status(403).json({
          message: "Permission insuffisante pour gérer les listes de ce projet",
          code: "LIST_WRITE_DENIED",
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export async function resolveProjectIdFromCreateListBody(
  req: Request
): Promise<number | null> {
  const body = req.body as Record<string, unknown>;
  const folderId = Number(body.folderId ?? body.id_folder);
  if (Number.isFinite(folderId) && folderId > 0) return folderId;

  const id_projet = Number(body.id_projet);
  if (Number.isFinite(id_projet) && id_projet > 0) return id_projet;

  const spaceId = Number(body.spaceId ?? body.id_space);
  if (!Number.isFinite(spaceId) || spaceId < 1) return null;

  const user = (req as any).user as { id_entreprise?: number | null };
  const ent = user?.id_entreprise;
  if (ent == null) return null;

  const first = await prisma.projet.findFirst({
    where: { id_space: spaceId, id_entreprise: ent, deleted_at: null },
    orderBy: { id_projet: "asc" },
    select: { id_projet: true },
  });
  return first?.id_projet ?? null;
}

export async function resolveProjectIdFromListParam(
  req: Request
): Promise<number | null> {
  const id_list = Number(req.params.id);
  if (!Number.isFinite(id_list) || id_list < 1) return null;
  return getProjectIdForList(id_list);
}
