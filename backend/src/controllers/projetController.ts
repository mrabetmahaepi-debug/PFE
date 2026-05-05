import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";


export const createProjet = async (req: Request, res: Response) => {
  try {
    const { nom_p, description_p, date_debut, date_fin, statut_p } = req.body;
    const user = (req as any).user;

    const projet = await prisma.projet.create({
      data: {
        nom_p,
        description_p,
        date_debut: date_debut ? new Date(date_debut) : null,
        date_fin: date_fin ? new Date(date_fin) : null,
        statut_p,
        id_entreprise: user.id_entreprise
      }
    });

    try {
      const ent = await prisma.entreprise.findUnique({ where: { id_entreprise: user.id_entreprise || 0 } });
      await (prisma as any).activity.create({
        data: {
          user: user.prenom ? `${user.prenom} ${user.nom}` : "Système",
          action: "Nouveau projet créé",
          entreprise: ent?.nom || "Non spécifiée",
          status: "ACTIVE",
          type: "project",
          entityId: projet.id_projet
        }
      });
      console.log("Activity logged");
    } catch (e) { console.error("Activity logging error", e); }

    res.status(201).json(projet);

  } catch (error) {
    res.status(500).json({ error: "Erreur création projet" });
  }
};



export const getAllProjets = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let whereClause: any = {};

    // 🔒 Restriction d'accès
    // SuperAdmin voit TOUT (tous les projets de toutes les entreprises)
    // Admin et Membre ne voient que les projets de leur entreprise où ils sont impliqués
    if (user.role !== "SuperAdmin") {
      whereClause.id_entreprise = user.id_entreprise;
      whereClause.OR = [
        { affectation: { some: { id_utilisateur: user.id } } },
        { membre_projet: { some: { id_utilisateur: user.id } } },
        { tache: { some: { assigne_a: user.id } } }
      ];
    }

    const projets = await prisma.projet.findMany({
      where: whereClause,
      include: {
        entreprise: {
          include: { admin: true }
        },
        _count: {
          select: { tache: true, membre_projet: true }
        },
        tache: {
          select: { statut_t: true }
        }
      },
      orderBy: { id_projet: 'desc' }
    });

    const projetsWithProgress = projets.map(p => {
      const totalTasks = p.tache.length;
      // In case TaskStatus is "Terminé" instead of "DONE" depending on language
      const completedTasks = p.tache.filter(t => t.statut_t === 'DONE' || t.statut_t === 'Terminé' || t.statut_t === 'Terminée').length;
      const avancement = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      const { tache, _count, entreprise, ...rest } = p;
      return { 
        ...rest, 
        entreprise,
        totalTasks, 
        completedTasks, 
        avancement,
        responsable: entreprise?.admin ? `${entreprise.admin.prenom || ''} ${entreprise.admin.nom || ''}`.trim() : 'Non assigné',
        membresCount: _count?.membre_projet || 0,
        tachesCount: _count?.tache || 0
      };
    });

    res.json(projetsWithProgress);

  } catch (error) {
    res.status(500).json({ error: "Erreur récupération projets" });
  }
};



export const getProjetById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const user = (req as any).user;

    const projet = await prisma.projet.findUnique({
      where: { id_projet: id },
      include: {
        affectation: {
          include: { utilisateur: true }
        },
        membre_projet: true,
        tache: {
          where: { assigne_a: user.id }
        }
      }
    });

    if (!projet) {
      return res.status(404).json({ message: "Projet inexistant" });
    }

    // Protection d'accès
    const isInvolved = user.role === "SuperAdmin" || 
                       projet.id_entreprise === user.id_entreprise && (
                         projet.affectation.some(a => a.id_utilisateur === user.id) ||
                         projet.membre_projet.some(m => m.id_utilisateur === user.id) ||
                         projet.tache.some(t => t.assigne_a === user.id)
                       );

    if (!isInvolved) {
      return res.status(403).json({ message: "Accès non autorisé à ce projet" });
    }

    res.json(projet);

  } catch (error) {
    res.status(500).json({ error: "Erreur récupération projet" });
  }
};



export const updateProjet = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { nom_p, description_p, date_debut, date_fin, statut_p } = req.body;

    const projet = await prisma.projet.update({
      where: { id_projet: id },
      data: {
        nom_p,
        description_p,
        date_debut: date_debut ? new Date(date_debut) : null,
        date_fin: date_fin ? new Date(date_fin) : null,
        statut_p
      }
    });

    res.json({
      message: "Projet mis à jour",
      projet
    });

  } catch (error) {
    res.status(500).json({ error: "Erreur mise à jour projet" });
  }
};



export const deleteProjet = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

    await prisma.projet.delete({
      where: { id_projet: id }
    });

    res.json({ message: "Projet supprimé" });

  } catch (error) {
    res.status(500).json({ error: "Erreur suppression projet" });
  }
};