import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";
import { MessagingService } from "../services/messaging.service";

export const getPendingUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.utilisateur.findMany({
      where: { statut: "PENDING" },
      include: { role: true, entreprise: true }
    });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la récupération des utilisateurs en attente" });
  }
};

export const getApprovals = async (req: Request, res: Response) => {
  try {
    const users = await prisma.utilisateur.findMany({
      where: { statut: "PENDING" },
      include: { role: true, entreprise: true }
    });

    const invitations = await prisma.invitation.findMany();

    const formattedUsers = users.map((u) => ({
      id: u.id_utilisateur,
      id_utilisateur: u.id_utilisateur,
      nom: u.nom,
      prenom: u.prenom,
      email: u.email,
      id_role: u.id_role,
      id_entreprise: u.id_entreprise,
      role: u.role?.nom || undefined,
    }));

    res.json({ users: formattedUsers, invitations });
  } catch (error: any) {
    console.error(error);
    require('fs').writeFileSync('backend_error.log', error.stack || String(error));
    res.status(500).json({ message: "Erreur lors de la récupération des approbations", error: error instanceof Error ? error.message : String(error) });
  }
};

export const approveUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { id_entreprise } = req.body;
  try {
    if (!id_entreprise) {
      return res.status(400).json({ message: "L'entreprise est obligatoire pour approuver un administrateur." });
    }

    // Get Admin role ID if user has no role
    const existingUser = await prisma.utilisateur.findUnique({ where: { id_utilisateur: parseInt(id as string) } });
    let updateData: any = { 
      statut: "ACTIVE",
      id_entreprise: parseInt(id_entreprise as string)
    };

    if (existingUser && !existingUser.id_role) {
      const adminRole = await prisma.role.findFirst({
        where: { nom: { in: ["Admin", "ADMIN", "admin"] } }
      });
      if (adminRole) {
        updateData.id_role = adminRole.id_role;
      }
    }

    const user = await prisma.utilisateur.update({
      where: { id_utilisateur: parseInt(id as string) },
      data: updateData
    });

    await prisma.notification.create({
      data: {
        sujet: "Compte activé",
        message: `Félicitations ${user.prenom}, votre compte a été approuvé par le Super Admin. Vous pouvez maintenant accéder à toutes les fonctionnalités.`,
        type: "success",
        id_utilisateur: user.id_utilisateur,
        date_envoi: new Date()
      }
    });

    // Mark original "pending" notification as read
    await prisma.notification.updateMany({
      where: {
        id_utilisateur: (req as any).user.id, // Notification sent to SuperAdmin
        metadata: { contains: `"userId":${user.id_utilisateur}` },
        is_read: false
      },
      data: { is_read: true }
    });

    try {
      const ent = await prisma.entreprise.findUnique({ where: { id_entreprise: user.id_entreprise || 0 } });
      await (prisma as any).activity.create({
        data: {
          user: `${user.prenom} ${user.nom}`,
          action: "Compte administrateur approuvé",
          entreprise: ent?.nom || "Non spécifiée",
          status: "ACTIVE",
          type: "user",
          entityId: user.id_utilisateur
        }
      });
      console.log("Activity logged");
    } catch (e) { console.error("Activity logging error", e); }

    // Auto-add to Admin Meeting group if they are an Admin
    await MessagingService.addUserToAdminMeetingGroup(user.id_utilisateur);

    res.json({ message: "Utilisateur approuvé avec succès" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de l'approbation de l'utilisateur" });
  }
};

export const rejectUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.utilisateur.update({
      where: { id_utilisateur: parseInt(id as string) },
      data: { statut: "REJECTED" }
    });

    // Mark notification as read
    await prisma.notification.updateMany({
      where: {
        id_utilisateur: (req as any).user.id,
        metadata: { contains: `"userId":${id}` },
        is_read: false
      },
      data: { is_read: true }
    });

    res.json({ message: "Utilisateur rejeté" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors du rejet de l'utilisateur" });
  }
};

export const approveInvitation = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { id_invitation: parseInt(id as string) }
    });

    if (!invitation) {
      return res.status(404).json({ message: "Invitation non trouvée" });
    }

    // Get Admin role ID
    let adminRole = await prisma.role.findFirst({
      where: { nom: { in: ["Admin", "ADMIN", "admin"] } }
    });

    // Create user from invitation
    const userData: any = {
      nom: invitation.nom,
      prenom: invitation.prenom,
      email: invitation.email,
      password: invitation.mot_de_passe,
      id_entreprise: invitation.id_entreprise,
      statut: "ACTIVE"
    };

    if (invitation.id_role) {
      userData.id_role = invitation.id_role;
    } else if (adminRole) {
      userData.id_role = adminRole.id_role;
    }

    const user = await prisma.utilisateur.create({
      data: userData
    });

    // Delete the invitation
    await prisma.invitation.delete({
      where: { id_invitation: parseInt(id as string) }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        sujet: "Invitation acceptée",
        message: `Félicitations ${user.prenom}, votre invitation a été acceptée par le Super Admin. Vous pouvez maintenant vous connecter.`,
        type: "success",
        id_utilisateur: user.id_utilisateur,
        date_envoi: new Date()
      }
    });

    try {
      const ent = await prisma.entreprise.findUnique({ where: { id_entreprise: user.id_entreprise || 0 } });
      await (prisma as any).activity.create({
        data: {
          user: `${user.prenom} ${user.nom}`,
          action: "Invitation administrateur approuvée",
          entreprise: ent?.nom || "Non spécifiée",
          status: "ACTIVE",
          type: "user",
          entityId: user.id_utilisateur
        }
      });
      console.log("Activity logged");
    } catch (e) { console.error("Activity logging error", e); }

    // Auto-add to Admin Meeting group if they are an Admin
    await MessagingService.addUserToAdminMeetingGroup(user.id_utilisateur);

    res.json({ message: "Invitation approuvée avec succès" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de l'approbation de l'invitation" });
  }
};

export const rejectInvitation = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.invitation.delete({
      where: { id_invitation: parseInt(id as string) }
    });
    res.json({ message: "Invitation rejetée" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors du rejet de l'invitation" });
  }
};

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const [totalEnterprises, totalAdmins, totalProjects, pendingApprovals] = await Promise.all([
      prisma.entreprise.count(),
      prisma.utilisateur.count({
        where: {
          role: {
            nom: { in: ["Admin", "ADMIN", "admin"] }
          }
        }
      }),
      prisma.projet.count(),
      prisma.utilisateur.count({
        where: { statut: "PENDING" }
      })
    ]);

    const recentUsers = await prisma.utilisateur.findMany({
      take: 5,
      orderBy: { id_utilisateur: 'desc' },
      include: { entreprise: true, role: true }
    });

    res.json({
      totalEnterprises,
      totalAdmins,
      totalProjects,
      pendingApprovals,
      recentUsers
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la récupération des statistiques" });
  }
};
export const searchGlobal = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.json({ projects: [], enterprises: [], users: [], approvals: [] });
    }

    const query = q.toLowerCase();

    const [projects, enterprises, users, approvals] = await Promise.all([
      prisma.projet.findMany({
        where: { nom_p: { contains: query } },
        take: 5,
        include: { entreprise: true }
      }),
      prisma.entreprise.findMany({
        where: { nom: { contains: query } },
        take: 5
      }),
      prisma.utilisateur.findMany({
        where: {
          OR: [
            { nom: { contains: query } },
            { prenom: { contains: query } },
            { email: { contains: query } }
          ],
          role: { nom: { in: ["Admin", "ADMIN", "admin"] } }
        },
        take: 5,
        include: { entreprise: true }
      }),
      prisma.utilisateur.findMany({
        where: {
          OR: [
            { nom: { contains: query } },
            { prenom: { contains: query } }
          ],
          statut: "PENDING"
        },
        take: 5
      })
    ]);

    res.json({
      projects: projects.map(p => ({ id: p.id_projet, title: p.nom_p, type: 'project', subtitle: p.entreprise?.nom })),
      enterprises: enterprises.map(e => ({ id: e.id_entreprise, title: e.nom, type: 'enterprise', subtitle: e.adresse })),
      users: users.map(u => ({ id: u.id_utilisateur, title: `${u.prenom} ${u.nom}`, type: 'user', subtitle: u.entreprise?.nom })),
      approvals: approvals.map(a => ({ id: a.id_utilisateur, title: `${a.prenom} ${a.nom}`, type: 'approval', subtitle: 'En attente' }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la recherche" });
  }
};
