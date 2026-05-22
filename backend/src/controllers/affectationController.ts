import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";
import {
  assertProjectPermission,
  getProjectPermissionContext,
} from "../services/projectPermission.service";

const CHEF_ROLE_LABEL = "Chef de Projet";

async function upsertMembreProjetStandalone(
  projetId: number,
  userId: number,
  roleProjet: string | null
) {
  const existing = await prisma.membre_projet.findFirst({
    where: { id_projet: projetId, id_utilisateur: userId },
  });
  if (existing) {
    await prisma.membre_projet.update({
      where: { id_membre_projet: existing.id_membre_projet },
      data: { role_projet: roleProjet },
    });
  } else {
    await prisma.membre_projet.create({
      data: {
        id_projet: projetId,
        id_utilisateur: userId,
        role_projet: roleProjet,
      },
    });
  }
}

export const assignChefProjet = async (req: Request, res: Response) => {
  try {
    const idProjet = parseInt(req.params.id as string);
    const authUser = (req as any).user;
    const permCtx = await getProjectPermissionContext(authUser, idProjet);
    try {
      assertProjectPermission(permCtx, "manage_project_members");
    } catch (e: any) {
      return res.status(e?.status ?? 403).json({
        message: e?.message || "Permission refusée",
        code: e?.code ?? "PROJECT_PERMISSION_DENIED",
        requiredPermission: e?.requiredPermission,
      });
    }
    const { id_utilisateur } = req.body;

    const projet = await prisma.projet.findUnique({
      where: { id_projet: idProjet }
    });

    if (!projet) {
      return res.status(404).json({ message: "Projet inexistant" });
    }

    const existingChef = await prisma.affectation.findFirst({
      where: {
        id_projet: idProjet,
        role_affectation: "chef"
      }
    });

    if (existingChef) {
      return res.status(400).json({
        message: "Ce projet a déjà un chef de projet"
      });
    }

    const assignee = await prisma.utilisateur.findUnique({
      where: { id_utilisateur }
    });

    if (!assignee) {
      return res.status(404).json({ message: "Utilisateur inexistant" });
    }

    const affectation = await prisma.affectation.create({
      data: {
        id_projet: idProjet,
        id_utilisateur,
        role_affectation: "chef"
      }
    });

    await prisma.projet.update({
      where: { id_projet: idProjet },
      data: { chef_de_projet_id: id_utilisateur },
    });

    await upsertMembreProjetStandalone(idProjet, id_utilisateur, CHEF_ROLE_LABEL);

    res.json({
      message: "Chef de projet assigné",
      affectation
    });

  } 
  catch (error:any) {
     console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export const updateChefProjet = async (req: Request, res: Response) => {
  try {
    const idProjet = parseInt(req.params.id as string);
    const authUser = (req as any).user;
    const permCtx = await getProjectPermissionContext(authUser, idProjet);
    try {
      assertProjectPermission(permCtx, "manage_project_members");
    } catch (e: any) {
      return res.status(e?.status ?? 403).json({
        message: e?.message || "Permission refusée",
        code: e?.code ?? "PROJECT_PERMISSION_DENIED",
        requiredPermission: e?.requiredPermission,
      });
    }
    const { id_utilisateur } = req.body;

    const projet = await prisma.projet.findUnique({
      where: { id_projet: idProjet },
      select: { chef_de_projet_id: true },
    });

    if (!projet) {
      return res.status(404).json({ message: "Projet inexistant" });
    }

    const previousChefId = projet.chef_de_projet_id ?? null;

    const assignee = await prisma.utilisateur.findUnique({
      where: { id_utilisateur }
    });

    if (!assignee) {
      return res.status(404).json({ message: "Utilisateur inexistant" });
    }

    const existingChef = await prisma.affectation.findFirst({
      where: {
        id_projet: idProjet,
        role_affectation: "chef"
      }
    });

    let affectation;
    if (existingChef) {
      affectation = await prisma.affectation.update({
        where: { id_affectation: existingChef.id_affectation },
        data: { id_utilisateur }
      });
    } else {
      affectation = await prisma.affectation.create({
        data: {
          id_projet: idProjet,
          id_utilisateur,
          role_affectation: "chef"
        }
      });
    }

    await prisma.projet.update({
      where: { id_projet: idProjet },
      data: { chef_de_projet_id: id_utilisateur },
    });

    await upsertMembreProjetStandalone(idProjet, id_utilisateur, CHEF_ROLE_LABEL);
    if (previousChefId && previousChefId !== id_utilisateur) {
      const oldRow = await prisma.membre_projet.findFirst({
        where: { id_projet: idProjet, id_utilisateur: previousChefId },
      });
      if (oldRow) {
        await prisma.membre_projet.update({
          where: { id_membre_projet: oldRow.id_membre_projet },
          data: { role_projet: "Membre" },
        });
      }
    }

    res.json({
      message: "Chef de projet mis à jour",
      affectation
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export const assignMembersToProjet = async (req: Request, res: Response) => {
  try {
    const idProjet = parseInt(req.params.id as string);
    const authUser = (req as any).user;
    const permCtx = await getProjectPermissionContext(authUser, idProjet);
    try {
      assertProjectPermission(permCtx, "manage_project_members");
    } catch (e: any) {
      return res.status(e?.status ?? 403).json({
        message: e?.message || "Permission refusée",
        code: e?.code ?? "PROJECT_PERMISSION_DENIED",
        requiredPermission: e?.requiredPermission,
      });
    }
    const { usersIds }: { usersIds: number[] } = req.body;

    const projet = await prisma.projet.findUnique({
      where: { id_projet: idProjet }
    });

    if (!projet) {
      return res.status(404).json({ message: "Projet inexistant" });
    }

    if (!usersIds || usersIds.length === 0) {
      return res.status(400).json({ message: "Aucun utilisateur fourni" });
    }

    const users = await prisma.utilisateur.findMany({
      where: {
        id_utilisateur: { in: usersIds }
      }
    });

    if (users.length !== usersIds.length) {
      return res.status(400).json({ message: "Certains utilisateurs n'existent pas" });
    }

    const existing = await prisma.affectation.findMany({
      where: {
        id_projet: idProjet,
        id_utilisateur: { in: usersIds }
      }
    });

    const existingIds = existing.map((a: any) => a.id_utilisateur);

    const newUsers = usersIds.filter(id => !existingIds.includes(id));

    const affectations = await prisma.affectation.createMany({
      data: newUsers.map(id => ({
        id_projet: idProjet,
        id_utilisateur: id,
        role_affectation: "membre"
      }))
    });

    for (const uid of newUsers) {
      const ex = await prisma.membre_projet.findFirst({
        where: { id_projet: idProjet, id_utilisateur: uid },
      });
      if (!ex) {
        await prisma.membre_projet.create({
          data: {
            id_projet: idProjet,
            id_utilisateur: uid,
            role_projet: "Membre",
          },
        });
      }
    }

    res.json({
      message: "Membres assignés",
      count: affectations.count
    });

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
export const assignMembers = async (req: Request, res: Response) => {
  try {
    const { id_projet, membres } = req.body; 
    if (!id_projet || !Array.isArray(membres)) {
      return res.status(400).json({ error: "id_projet et membres requis" });
    }

    const affectations = [];

    for (const id_utilisateur of membres) {

        const userExist = await prisma.utilisateur.findUnique({
        where: { id_utilisateur },
      });
      if (!userExist) continue;

      const newAff = await prisma.affectation.create({
        data: {
          id_projet,
          id_utilisateur,
          role_affectation: "membre",
          statut: "active",
          date_affectation: new Date(),
        },
      });
      affectations.push(newAff);
    }

    res.status(201).json({
      message: "Membres assignés au projet",
      affectations,
    });

  } catch (error) {
    console.error("Erreur assignation membres :", error);
    res.status(500).json({ error: "Erreur assignation membres" });
  }
};
