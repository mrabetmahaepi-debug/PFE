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
      poste: u.poste,
      createdAt: u.createdAt,
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
    const existingUser = await prisma.utilisateur.findUnique({ 
      where: { id_utilisateur: parseInt(id as string) } 
    });
    
    if (!existingUser) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    let finalEnterpriseId = id_entreprise ? parseInt(id_entreprise as string) : null;

    // If no enterprise ID provided, create one from user's "poste" (Company Name)
    if (!finalEnterpriseId && existingUser.poste) {
      const newEnt = await prisma.entreprise.create({
        data: {
          nom: existingUser.poste,
          statut: "active",
          admin_id: existingUser.id_utilisateur // Link the admin immediately
        }
      });
      finalEnterpriseId = newEnt.id_entreprise;
    }

    if (!finalEnterpriseId) {
      return res.status(400).json({ message: "Le nom de l'entreprise est requis (champ 'poste' manquant)." });
    }

    let updateData: any = { 
      statut: "ACTIVE",
      id_entreprise: finalEnterpriseId
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

    // Also update the enterprise to ensure it has this user as admin (redundant but safe)
    await prisma.entreprise.update({
      where: { id_entreprise: finalEnterpriseId },
      data: { admin_id: user.id_utilisateur }
    });

    await prisma.notification.create({
      data: {
        sujet: "Compte activé",
        message: `Félicitations ${user.prenom}, votre compte a été approuvé par le Super Admin.`,
        type: "success",
        id_utilisateur: user.id_utilisateur,
        date_envoi: new Date()
      }
    });

    // Mark original notification as read
    try {
      await prisma.notification.updateMany({
        where: {
          metadata: { contains: `"userId":${user.id_utilisateur}` },
          is_read: false
        },
        data: { is_read: true }
      });
    } catch (e) { console.error("Notif update error", e); }

    try {
      const ent = await prisma.entreprise.findUnique({ where: { id_entreprise: user.id_entreprise || 0 } });
      await prisma.activity.create({
        data: {
          user: `${user.prenom} ${user.nom}`,
          action: "Compte administrateur approuvé",
          entreprise: ent?.nom || "Non spécifiée",
          status: "ACTIVE",
          type: "user",
          entityId: user.id_utilisateur
        }
      });
    } catch (e) { console.error("Activity logging error", e); }

    // Auto-add to Admin Meeting group - Wrap in try catch to avoid blocking the main flow
    try {
      if (MessagingService && typeof MessagingService.addUserToAdminMeetingGroup === 'function') {
        await MessagingService.addUserToAdminMeetingGroup(user.id_utilisateur);
      }
    } catch (msgErr) {
      console.error("Failed to add user to messaging group:", msgErr);
    }

    res.json({ message: "Utilisateur approuvé avec succès" });
  } catch (error: any) {
    console.error("APPROVE_USER_ERROR:", error);
    res.status(500).json({ message: "Erreur lors de l'approbation", error: error.message });
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
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const startOfToday = new Date();
    startOfToday.setHours(0,0,0,0);

    const [
      totalEnterprises,
      allUsers,
      totalProjects,
      pendingApprovalsCount,
      roleDistribution,
      recentActivities,
      topEnterprises,
      activeEnterprises,
      enterprisesWithoutAdmin,
      lastWeekEnterprises,
      enterprisesToday,
    ] = await Promise.all([
      prisma.entreprise.count(),
      prisma.utilisateur.findMany({
        where: { NOT: { role: { nom: 'SuperAdmin' } } },
        select: { id_utilisateur: true, email: true, createdAt: true, role: { select: { nom: true } }, statut: true }
      }),
      prisma.projet.count(),
      prisma.utilisateur.count({
        where: { statut: "PENDING" }
      }),
      prisma.role.findMany({
        select: {
          nom: true,
          _count: { select: { utilisateur: true } }
        }
      }),
      prisma.activity.findMany({
        take: 15,
        orderBy: { date: 'desc' }
      }),
      prisma.entreprise.findMany({
        take: 5,
        select: {
          id_entreprise: true,
          nom: true,
          _count: { select: { projet: true, utilisateur: true } }
        },
        orderBy: { projet: { _count: 'desc' } }
      }),
      prisma.entreprise.count({ where: { statut: 'active' } }),
      prisma.entreprise.findMany({
        where: { admin_id: null },
        select: { id_entreprise: true, nom: true }
      }),
      prisma.entreprise.count({ where: { createdAt: { lt: last7Days } } }),
      prisma.entreprise.count({ where: { createdAt: { gte: startOfToday } } }),
    ]);

    const activeUsersList = allUsers.filter(u => {
      const roleName = (u as any).role?.nom;
      // Since lastLogin is removed, we use createdAt or just consider them active if they are Admins
      const isAdminRole = roleName && ['Admin', 'ADMIN', 'admin'].includes(roleName);
      const isActive = !!isAdminRole; // Simplified logic without lastLogin
      
      console.log(`DASHBOARD_DEBUG: ${u.email} | isAdmin=${isAdminRole} | role=${roleName} | FINAL=${isActive}`);
      return isActive;
    });
    
    console.log("TOTAL ACTIVE ADMINS:", activeUsersList.length);

    const activeUsersCount = activeUsersList.length;
    const totalUsers = allUsers.length;
    
    const activeAdminIds = activeUsersList.map((u: any) => u.id_utilisateur);

    // Additional metrics for health and growth
    const activeAdmins = activeUsersList.length;
    
    const lastWeekUsers = allUsers.filter(u => u.createdAt && new Date(u.createdAt) < last7Days).length;
    const usersToday = allUsers.filter(u => u.createdAt && new Date(u.createdAt) >= startOfToday).length;
    const adminsToday = allUsers.filter(u => 
      u.createdAt && new Date(u.createdAt) >= startOfToday && 
      ['Admin', 'ADMIN', 'admin'].includes(((u as any).role)?.nom)
    ).length;
    const inactiveAdmins = await prisma.utilisateur.findMany({
      where: {
        role: { nom: { in: ['Admin', 'ADMIN', 'admin'] } },
        statut: 'ACTIVE',
        id_utilisateur: { notIn: activeAdminIds }
      },
      select: { id_utilisateur: true, nom: true, prenom: true }
    });

    const evolutionData: { date: string; users: number; enterprises: number; admins: number; }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      evolutionData.push({ date: dateStr, users: 0, enterprises: 0, admins: 0 });
    }

    // Use already fetched allUsers for users and admins evolution
    allUsers.forEach(u => {
      if (!u.createdAt) return;
      const d = new Date(u.createdAt).toISOString().split('T')[0];
      const entry = evolutionData.find(e => e.date === d);
      if (entry) {
        entry.users++;
        const roleName = (u as any).role?.nom;
        if (roleName && ['Admin', 'ADMIN', 'admin'].includes(roleName)) {
          entry.admins++;
        }
      }
    });

    // DEBUG ENTREPRISES
    const allEnterprisesList = await prisma.entreprise.findMany({
      select: { id_entreprise: true, nom: true, createdAt: true, statut: true }
    });
    console.log("TOTAL ENTREPRISES DB:", allEnterprisesList.length);
    console.log(JSON.stringify(allEnterprisesList.map(e => ({
      id: e.id_entreprise,
      nom: e.nom,
      createdAt: e.createdAt,
      statut: e.statut
    })), null, 2));

    const enterprisesInPeriod = await prisma.entreprise.findMany({
      where: { createdAt: { gte: last7Days } },
      select: { createdAt: true }
    });

    enterprisesInPeriod.forEach(e => {
      if (!e.createdAt) return;
      const d = new Date(e.createdAt).toISOString().split('T')[0];
      const entry = evolutionData.find(ev => ev.date === d);
      if (entry) entry.enterprises++;
    });

    console.log("CHART DATA TO SEND:", JSON.stringify(evolutionData, null, 2));

    const totalAdmins = allUsers.filter(u => 
      ['Admin', 'ADMIN', 'admin'].includes(((u as any).role)?.nom)
    ).length;


    const health = {
      users: { active: activeUsersCount, total: totalUsers, perc: totalUsers > 0 ? Math.round((activeUsersCount / totalUsers) * 100) : 0 },
      admins: { active: activeAdmins, total: totalAdmins, perc: totalAdmins > 0 ? Math.round((activeAdmins / totalAdmins) * 100) : 0 },
      enterprises: { active: activeEnterprises, total: totalEnterprises, perc: totalEnterprises > 0 ? Math.round((activeEnterprises / totalEnterprises) * 100) : 0 },
    };

    const growth = {
      users: {
        percentage: lastWeekUsers > 0 ? Math.round(((totalUsers - lastWeekUsers) / lastWeekUsers) * 100) : 0,
        today: usersToday
      },
      enterprises: {
        percentage: lastWeekEnterprises > 0 ? Math.round(((totalEnterprises - lastWeekEnterprises) / lastWeekEnterprises) * 100) : 0,
        today: enterprisesToday
      },
      admins: { today: adminsToday }
    };

    res.json({
      totalEnterprises,
      totalUsers,
      totalAdmins,
      totalProjects,
      pendingApprovals: pendingApprovalsCount,
      roleDistribution: roleDistribution.map(r => ({ name: r.nom, value: r._count.utilisateur })),
      recentActivities,
      topEnterprises: topEnterprises.map(e => ({
        id: e.id_entreprise,
        name: e.nom,
        projects: e._count.projet,
        users: e._count.utilisateur
      })),
      dailyEvolution: evolutionData,
      health,
      alerts: {
        noAdmin: enterprisesWithoutAdmin,
        pending: pendingApprovalsCount,
        inactiveAdmins: inactiveAdmins.map(a => ({ id: a.id_utilisateur, name: `${a.prenom} ${a.nom}` }))
      },
      growth
    });
  } catch (error: any) {
    console.error("DASHBOARD STATS ERROR:", error);
    res.status(500).json({ 
      message: "Erreur lors de la récupération des statistiques",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
