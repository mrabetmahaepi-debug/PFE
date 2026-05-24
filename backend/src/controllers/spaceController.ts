import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";
import { isSuperAdmin } from "../middleware/permissions";
import { userCanReadProject } from "../lib/projectAccess";
import {
  attachOrphanProjects,
  buildProjectNode,
  DEFAULT_SPACE_NAME,
  ensureMonEspace,
  loadHierarchyEntities,
  loadReadableProjectsAsync,
  loadTrashItems,
  moveSpaceToTrash,
  resolveEnterpriseId,
  restoreSpaceFromTrash,
  toInt,
} from "../lib/spaceHierarchy";
import { isGlobalMemberUser } from "../lib/isGlobalMember";
import { loadMemberTrashItems } from "../lib/memberTrash";
import {
  filterReadableProjectsForSidebar,
  shouldHideEmptyProjectInSidebar,
} from "../lib/sidebarAccessFilter";
import { getProjectPermissionContext } from "../services/projectPermission.service";

const db = prisma as any;

async function prepareTenantSpaces(user: any, id_entreprise: number | null) {
  if (id_entreprise) {
    await ensureMonEspace(id_entreprise);
    await attachOrphanProjects(id_entreprise);
  }
}

export const listSpaces = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const id_entreprise = resolveEnterpriseId(user);
    if (!id_entreprise && !isSuperAdmin(user)) {
      return res.json([]);
    }

    if (id_entreprise) await prepareTenantSpaces(user, id_entreprise);

    const where =
      isSuperAdmin(user) && !id_entreprise
        ? {}
        : { id_entreprise: id_entreprise! };

    const spaces = await db.space_pm.findMany({
      where: { ...where, deleted_at: null },
      orderBy: [{ position: "asc" }, { id_space: "asc" }],
      select: {
        id_space: true,
        nom: true,
        description: true,
        position: true,
        id_entreprise: true,
      },
    });

    res.json(spaces);
  } catch (error) {
    console.error("listSpaces:", error);
    res.status(500).json({ message: "Erreur chargement des espaces" });
  }
};

export const getProjectsBySpace = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const id_space = toInt(req.params.id);
    if (!id_space) return res.status(400).json({ message: "ID espace invalide" });

    const space = await db.space_pm.findUnique({ where: { id_space } });
    if (!space) return res.status(404).json({ message: "Espace introuvable" });

    const id_entreprise = resolveEnterpriseId(user);
    if (!isSuperAdmin(user) && space.id_entreprise !== id_entreprise) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const readable = (
      await loadReadableProjectsAsync(req, user, space.id_entreprise)
    ).filter(
      (p) => p.id_space === id_space
    );
    const projectIds = readable.map((p) => p.id_projet);
    const { sprintsFlat, listsFlat, tasks } = await loadHierarchyEntities(projectIds);

    const projects = await Promise.all(
      readable.map((p) => buildProjectNode(p, sprintsFlat, listsFlat, tasks, user))
    );

    res.json({ id_space, projects });
  } catch (error) {
    console.error("getProjectsBySpace:", error);
    res.status(500).json({ message: "Erreur chargement des projets" });
  }
};

export const createSpace = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const id_entreprise = resolveEnterpriseId(user);
    if (!id_entreprise) {
      return res.status(400).json({ message: "Entreprise requise" });
    }
    const nom = String(req.body?.nom ?? "").trim();
    if (!nom) return res.status(400).json({ message: "nom requis" });

    const space = await db.space_pm.create({
      data: {
        nom,
        description: req.body?.description ?? null,
        position: toInt(req.body?.position) ?? 0,
        id_entreprise,
      },
    });
    res.status(201).json(space);
  } catch (error) {
    console.error("createSpace:", error);
    res.status(500).json({ message: "Erreur création espace" });
  }
};

export const updateSpace = async (req: Request, res: Response) => {
  try {
    const id_space = toInt(req.params.id);
    if (!id_space) return res.status(400).json({ message: "ID invalide" });
    const user = (req as any).user;
    const id_entreprise = resolveEnterpriseId(user);

    const existing = await db.space_pm.findUnique({ where: { id_space } });
    if (!existing) return res.status(404).json({ message: "Espace introuvable" });
    if (!isSuperAdmin(user) && existing.id_entreprise !== id_entreprise) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const nom = req.body?.nom !== undefined ? String(req.body.nom).trim() : undefined;
    const space = await db.space_pm.update({
      where: { id_space },
      data: {
        ...(nom !== undefined ? { nom: nom || existing.nom } : {}),
        ...(req.body?.description !== undefined
          ? { description: req.body.description }
          : {}),
        ...(req.body?.position !== undefined
          ? { position: toInt(req.body.position) ?? existing.position }
          : {}),
      },
    });
    res.json(space);
  } catch (error) {
    console.error("updateSpace:", error);
    res.status(500).json({ message: "Erreur mise à jour espace" });
  }
};

export const deleteSpace = async (req: Request, res: Response) => {
  try {
    const id_space = toInt(req.params.id);
    if (!id_space) return res.status(400).json({ message: "ID invalide" });
    const user = (req as any).user;
    const id_entreprise = resolveEnterpriseId(user);

    const existing = await db.space_pm.findUnique({
      where: { id_space },
    });
    if (!existing) return res.status(404).json({ message: "Espace introuvable" });
    if (!isSuperAdmin(user) && existing.id_entreprise !== id_entreprise) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    await db.space_pm.delete({ where: { id_space } });
    res.json({ message: "Espace supprimé définitivement" });
  } catch (error) {
    console.error("deleteSpace:", error);
    res.status(500).json({ message: "Erreur suppression espace" });
  }
};

export const trashSpace = async (req: Request, res: Response) => {
  try {
    const id_space = toInt(req.params.id);
    if (!id_space) return res.status(400).json({ message: "ID invalide" });
    const user = (req as any).user;
    const id_entreprise = resolveEnterpriseId(user);
    const existing = await db.space_pm.findUnique({ where: { id_space } });
    if (!existing) return res.status(404).json({ message: "Espace introuvable" });
    if (!isSuperAdmin(user) && existing.id_entreprise !== id_entreprise) {
      return res.status(403).json({ message: "Accès refusé" });
    }
    await moveSpaceToTrash(id_space);
    res.json({ message: "Espace déplacé vers la corbeille" });
  } catch (error) {
    console.error("trashSpace:", error);
    res.status(500).json({ message: "Erreur corbeille espace" });
  }
};

export const restoreSpace = async (req: Request, res: Response) => {
  try {
    const id_space = toInt(req.params.id);
    if (!id_space) return res.status(400).json({ message: "ID invalide" });
    const user = (req as any).user;
    const id_entreprise = resolveEnterpriseId(user);
    const existing = await db.space_pm.findUnique({ where: { id_space } });
    if (!existing) return res.status(404).json({ message: "Espace introuvable" });
    if (!isSuperAdmin(user) && existing.id_entreprise !== id_entreprise) {
      return res.status(403).json({ message: "Accès refusé" });
    }
    await restoreSpaceFromTrash(id_space);
    res.json({ message: "Espace restauré" });
  } catch (error) {
    console.error("restoreSpace:", error);
    res.status(500).json({ message: "Erreur restauration espace" });
  }
};

export const getWorkspaceTrash = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const id_entreprise = resolveEnterpriseId(user);
    if (!id_entreprise && !isSuperAdmin(user)) {
      return res.json({ items: [] });
    }
    const items = isGlobalMemberUser(user)
      ? await loadMemberTrashItems(req, user, id_entreprise)
      : await loadTrashItems(req, user, id_entreprise);
    res.json({ items });
  } catch (error) {
    console.error("getWorkspaceTrash:", error);
    res.status(500).json({ message: "Erreur chargement corbeille" });
  }
};

/** Full sidebar tree: Space → Project → Sprint → List */
export const getSpacesHierarchy = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userId = user?.id;
  const logPrefix = `[getSpacesHierarchy user=${userId ?? "?"}]`;

  try {
    const id_entreprise = resolveEnterpriseId(user);

    if (!id_entreprise && !isSuperAdmin(user)) {
      console.info(logPrefix, "no enterprise — returning empty spaces");
      return res.json({ spaces: [] });
    }

    if (id_entreprise) {
      try {
        await prepareTenantSpaces(user, id_entreprise);
      } catch (prepErr) {
        console.warn(logPrefix, "prepareTenantSpaces failed (continuing):", prepErr);
      }
    }

    const spaceWhere = id_entreprise
      ? { id_entreprise, deleted_at: null }
      : { deleted_at: null };

    let spaces: any[] = [];
    try {
      spaces = await db.space_pm.findMany({
        where: spaceWhere,
        orderBy: [{ position: "asc" }, { id_space: "asc" }],
      });
    } catch (spaceErr) {
      console.error(logPrefix, "space_pm.findMany failed:", spaceErr);
      spaces = [];
    }

    let readable = (
      await loadReadableProjectsAsync(req, user, id_entreprise)
    ).filter((p: any) => !p.deleted_at);

    console.info(
      logPrefix,
      `enterprise=${id_entreprise ?? "all"} spaces=${spaces.length} readableProjects=${readable.length}`
    );

    const projectIds = readable.map((p) => p.id_projet);
    let sprintsFlat: any[] = [];
    let listsFlat: any[] = [];
    let tasks: any[] = [];
    try {
      const entities = await loadHierarchyEntities(projectIds);
      sprintsFlat = entities.sprintsFlat;
      listsFlat = entities.listsFlat;
      tasks = entities.tasks;
    } catch (entityErr) {
      console.warn(logPrefix, "loadHierarchyEntities failed (empty tree):", entityErr);
    }

    if (isGlobalMemberUser(user)) {
      readable = filterReadableProjectsForSidebar(
        { id: Number(userId) },
        readable,
        tasks
      );
    }

    const projectsBySpace = new Map<number, any[]>();
    for (const p of readable) {
      try {
        let spaceKey = toInt(p.id_space);
        if (!spaceKey && id_entreprise) {
          spaceKey = await ensureMonEspace(id_entreprise);
        }
        if (!spaceKey) continue;
        const node = await buildProjectNode(
          p,
          sprintsFlat,
          listsFlat,
          tasks,
          user
        );
        const ctx = await getProjectPermissionContext(user, Number(p.id_projet));
        if (
          shouldHideEmptyProjectInSidebar(ctx) &&
          node.hasAccessibleContent === false
        ) {
          continue;
        }
        const bucket = projectsBySpace.get(spaceKey) ?? [];
        bucket.push(node);
        projectsBySpace.set(spaceKey, bucket);
      } catch (projErr) {
        console.error(
          logPrefix,
          `buildProjectNode failed for project ${p?.id_projet}:`,
          projErr
        );
      }
    }

    let result = spaces.map((s: any) => ({
      id_space: s.id_space,
      nom: s.nom,
      description: s.description ?? null,
      position: s.position ?? 0,
      projects: projectsBySpace.get(s.id_space) ?? [],
    }));

    if (result.length === 0 && id_entreprise) {
      const sid = await ensureMonEspace(id_entreprise);
      result = [
        {
          id_space: sid,
          nom: DEFAULT_SPACE_NAME,
          description: null,
          position: 0,
          projects: [],
        },
      ];
    }

    if (result.length === 0 && readable.length > 0 && id_entreprise) {
      const sid = await ensureMonEspace(id_entreprise);
      const projects: any[] = [];
      for (const p of readable) {
        try {
          projects.push(
            await buildProjectNode(p, sprintsFlat, listsFlat, tasks, user)
          );
        } catch (projErr) {
          console.error(
            logPrefix,
            `fallback buildProjectNode failed for project ${p?.id_projet}:`,
            projErr
          );
        }
      }
      result = [
        {
          id_space: sid,
          nom: DEFAULT_SPACE_NAME,
          description: null,
          position: 0,
          projects,
        },
      ];
    }

    return res.json({ spaces: result });
  } catch (error) {
    console.error("[getSpacesHierarchy] fatal:", {
      userId,
      role: user?.role,
      id_entreprise: user?.id_entreprise,
      error,
    });
    return res.json({ spaces: [] });
  }
};
