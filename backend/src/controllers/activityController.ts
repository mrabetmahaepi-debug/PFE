import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";

export const getActivities = async (req: Request, res: Response) => {
  try {
    const [dbActivities, users, projects, enterprises, tasks] = await Promise.all([
      (prisma as any).activity.findMany({ orderBy: { date: 'desc' } }),
      prisma.utilisateur.findMany({ include: { entreprise: true } }),
      prisma.projet.findMany({ include: { entreprise: true } }),
      prisma.entreprise.findMany(),
      prisma.tache.findMany({ include: { projet: true, utilisateur: true } })
    ]);

    const allActivities: any[] = [];

    // Map Users
    users.forEach((u: any) => {
      allActivities.push({
        id: `user-${u.id_utilisateur}`,
        entityId: u.id_utilisateur,
        user: `${u.prenom || ''} ${u.nom || ''}`.trim() || 'Admin',
        action: u.statut === 'PENDING' ? 'Admin invité' : 'Compte utilisateur activé',
        enterprise: u.entreprise?.nom || 'Plateforme',
        date: u.createdAt || new Date(Date.now() - (10000 - u.id_utilisateur) * 1000),
        status: u.statut === 'PENDING' ? 'PENDING' : 'ACTIVE',
        type: 'user'
      });
    });

    // Map Projects
    projects.forEach((p: any) => {
      allActivities.push({
        id: `proj-${p.id_projet}`,
        entityId: p.id_projet,
        user: 'Système / Equipe',
        action: 'Projet créé',
        enterprise: p.entreprise?.nom || 'Plateforme',
        date: p.date_debut || new Date(),
        status: p.statut_p === 'Terminé' || p.statut_p === 'Livré' ? 'ACTIVE' : 'PENDING',
        type: 'project'
      });
    });

    // Map Enterprises
    enterprises.forEach((e: any) => {
      allActivities.push({
        id: `ent-${e.id_entreprise}`,
        entityId: e.id_entreprise,
        user: 'Super Admin',
        action: 'Entreprise créée',
        enterprise: e.nom,
        date: (e as any).createdAt || new Date(),
        status: e.statut === 'active' ? 'ACTIVE' : 'PENDING',
        type: 'enterprise'
      });
    });

    // Map Tasks
    tasks.forEach((t: any) => {
      const isDone = t.statut_t === 'DONE' || t.statut_t === 'Terminé' || t.statut_t === 'Terminée';
      allActivities.push({
        id: `task-${t.id_tache}`,
        entityId: t.id_tache,
        user: t.utilisateur ? `${t.utilisateur.prenom} ${t.utilisateur.nom}` : 'Non assigné',
        action: isDone ? 'Tâche terminée' : 'Nouvelle tâche créée',
        enterprise: 'Projet: ' + (t.projet?.nom_p || 'N/A'),
        date: t.date_fin_t || t.date_debut_t || new Date(),
        status: isDone ? 'ACTIVE' : 'PENDING',
        type: 'task'
      });
    });

    // Map DB Activities
    dbActivities.forEach((act: any) => {
      allActivities.push({
        id: `db-${act.id}`,
        entityId: act.entityId,
        user: act.user,
        action: act.action,
        enterprise: act.entreprise || 'Plateforme',
        date: act.date,
        status: act.status,
        type: act.type || 'info'
      });
    });

    // Sort by date desc
    allActivities.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeB === timeA) {
        return (b.entityId || 0) - (a.entityId || 0);
      }
      return timeB - timeA;
    });

    console.log("GET /activities returned:", allActivities.length, "activities");
    res.json(allActivities);
  } catch (error) {
    console.error("Erreur récupération activities:", error);
    res.status(500).json({ message: "Erreur lors de la récupération des activités" });
  }
};
