import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";
import { isEnterpriseAdmin, isSuperAdmin } from "../middleware/permissions";
import {
  isSuperAdminPlatformActivity,
  normalizeSuperAdminAction,
} from "../lib/activityFilters";
import {
  getEnterpriseRecentActivities,
  getMemberRecentActivities,
} from "../services/enterpriseActivity.service";

/** Tenant admin dashboard — enterprise-scoped admin activity feed (real data). */
export const getEnterpriseActivities = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    if (!isSuperAdmin(user) && !isEnterpriseAdmin(user)) {
      return res.status(403).json({
        message: "Réservé aux administrateurs d'entreprise",
      });
    }

    const entId = user?.id_entreprise;
    if (entId == null) {
      return res.json([]);
    }

    const ent = await prisma.entreprise.findUnique({
      where: { id_entreprise: Number(entId) },
      select: { nom: true },
    });
    if (!ent?.nom) {
      return res.json([]);
    }

    const limitRaw = parseInt(String(req.query.limit ?? "20"), 10);
    const limit = Number.isFinite(limitRaw) ? limitRaw : 20;

    const activities = await getEnterpriseRecentActivities(
      Number(entId),
      ent.nom,
      limit
    );

    return res.json(activities);
  } catch (error) {
    console.error("[getEnterpriseActivities] error:", error);
    return res.status(500).json({
      message: "Erreur lors de la récupération de l'activité entreprise",
    });
  }
};

/** Member dashboard — projects & assigned tasks for the connected user. */
export const getMemberActivities = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ message: "Non authentifié" });
    }

    const limitRaw = parseInt(String(req.query.limit ?? "12"), 10);
    const limit = Number.isFinite(limitRaw) ? limitRaw : 12;

    const activities = await getMemberRecentActivities(Number(user.id), limit);
    return res.json(activities);
  } catch (error) {
    console.error("[getMemberActivities] error:", error);
    return res.status(500).json({
      message: "Erreur lors de la récupération de l'activité",
    });
  }
};

/** SuperAdmin platform feed — enterprises & global admin actions only. */
export const getActivities = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !isSuperAdmin(user)) {
      return res.status(403).json({ message: "Réservé au Super Admin" });
    }

    const limitRaw = parseInt(String(req.query.limit ?? "100"), 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 200)
      : 100;

    const [dbActivities, enterprises] = await Promise.all([
      (prisma as any).activity.findMany({
        orderBy: { date: "desc" },
        take: limit * 3,
      }),
      prisma.entreprise.findMany({
        select: {
          id_entreprise: true,
          nom: true,
          statut: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);

    const allActivities: Array<{
      id: string;
      entityId: number;
      user: string;
      action: string;
      enterprise: string;
      date: Date;
      status: string;
      type: string;
      entityType: string;
    }> = [];

    const seenEnterpriseIds = new Set<number>();

    for (const act of dbActivities) {
      const row = {
        type: act.type,
        action: act.action,
        user: act.user,
        entreprise: act.entreprise,
      };
      if (!isSuperAdminPlatformActivity(row)) continue;

      if (act.type === "enterprise" && act.entityId) {
        seenEnterpriseIds.add(Number(act.entityId));
      }

      const canonicalAction = normalizeSuperAdminAction(act.action);
      if (!canonicalAction) continue;

      allActivities.push({
        id: `db-${act.id}`,
        entityId: act.entityId ?? act.id,
        user: act.user,
        action: canonicalAction,
        enterprise: act.entreprise || "Plateforme",
        date: act.date,
        status: act.status,
        type: canonicalAction === "Entreprise créée" ? "enterprise" : "user",
        entityType:
          canonicalAction === "Entreprise créée" ? "ENTREPRISE" : "ADMIN",
      });
    }

    for (const e of enterprises) {
      if (seenEnterpriseIds.has(e.id_entreprise)) continue;
      allActivities.push({
        id: `ent-${e.id_entreprise}`,
        entityId: e.id_entreprise,
        user: "Super Admin",
        action: "Entreprise créée",
        enterprise: e.nom || "Entreprise",
        date: (e as { createdAt?: Date }).createdAt || new Date(),
        status: e.statut === "active" ? "ACTIVE" : "PENDING",
        type: "enterprise",
        entityType: "ENTREPRISE",
      });
    }

    allActivities.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeB === timeA) {
        return (b.entityId || 0) - (a.entityId || 0);
      }
      return timeB - timeA;
    });

    const result = allActivities.slice(0, limit);
    console.log("GET /activities returned:", result.length, "activities");
    res.json(result);
  } catch (error) {
    console.error("Erreur récupération activities:", error);
    res.status(500).json({ message: "Erreur lors de la récupération des activités" });
  }
};
