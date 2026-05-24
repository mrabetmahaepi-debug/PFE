import { Request, Response } from "express";
import { isEnterpriseAdmin, isSuperAdmin } from "../middleware/permissions";
import { getAdminRecommendationApplyContext, AdminRecommendationScopeError } from "../services/adminRecommendationApply.service";
import {
  getAppliedRecommendationRecords,
  logAdminRecommendationActivity,
  recordAdminRecommendationState,
  AI_FAIL_MESSAGE,
} from "../services/adminRecommendationState.service";
import {
  getAdminRecommendations,
  type AdminRecommendationItem,
} from "../services/adminRecommendations.service";

function adminGuard(user: any, res: Response): { entId: number; adminUserId: number } | null {
  if (!user) {
    res.status(401).json({ message: "Utilisateur non authentifié" });
    return null;
  }
  if (!isSuperAdmin(user) && !isEnterpriseAdmin(user)) {
    res.status(403).json({ message: "Réservé aux administrateurs d'entreprise" });
    return null;
  }
  const entId = user?.id_entreprise;
  if (entId == null) {
    res.status(400).json({ message: "Entreprise introuvable pour cet administrateur" });
    return null;
  }
  const adminUserId = Number(user.id);
  if (!Number.isFinite(adminUserId) || adminUserId <= 0) {
    res.status(400).json({ message: "Utilisateur administrateur invalide" });
    return null;
  }
  return { entId: Number(entId), adminUserId };
}

function activityUserName(user: any): string {
  const full = [user?.prenom, user?.nom].filter(Boolean).join(" ").trim();
  return full || user?.email || "Administrateur";
}

const EMPTY_RECOMMENDATIONS_RESPONSE = {
  success: true,
  recommendations: [] as AdminRecommendationItem[],
  appliedRecommendations: [],
  provider: "data-driven" as const,
  generatedAt: new Date().toISOString(),
  configured: false,
};

/**
 * GET /api/me/admin/recommendations
 */
export const getAdminRecommendationsController = async (
  req: Request,
  res: Response
) => {
  const user = (req as any).user;
  const guard = adminGuard(user, res);
  if (guard == null) {
    if (res.headersSent) return;
    return res.status(200).json(EMPTY_RECOMMENDATIONS_RESPONSE);
  }
  const { entId, adminUserId } = guard;

  try {
    const result = await getAdminRecommendations(entId, adminUserId);
    let appliedRecommendations: Awaited<
      ReturnType<typeof getAppliedRecommendationRecords>
    > = [];
    try {
      appliedRecommendations = await getAppliedRecommendationRecords(entId, adminUserId);
    } catch (appliedErr) {
      console.error("getAppliedRecommendationRecords failed:", appliedErr);
    }
    return res.status(200).json({ ...result, appliedRecommendations });
  } catch (err) {
    console.error("getAdminRecommendationsController error:", err);
    return res.status(200).json({
      success: false,
      recommendations: [],
      appliedRecommendations: [],
      provider: null,
      generatedAt: new Date().toISOString(),
      configured: false,
      message: AI_FAIL_MESSAGE,
    });
  }
};

/**
 * POST /api/me/admin/recommendations/apply-context
 */
export const postAdminRecommendationApplyContextController = async (
  req: Request,
  res: Response
) => {
  try {
    const user = (req as any).user;
    const guard = adminGuard(user, res);
    if (guard == null) return;
    const { entId, adminUserId } = guard;

    const rec = req.body?.recommendation as AdminRecommendationItem | undefined;
    if (!rec?.id) {
      return res.status(400).json({ message: "Recommandation invalide" });
    }

    const context = await getAdminRecommendationApplyContext(entId, adminUserId, rec);
    return res.json(context);
  } catch (err) {
    if (err instanceof AdminRecommendationScopeError) {
      return res.status(403).json({ message: err.message });
    }
    console.error("postAdminRecommendationApplyContextController error:", err);
    return res.status(500).json({
      message: "Impossible de charger le contexte d'application",
    });
  }
};

/**
 * POST /api/me/admin/recommendations/state
 */
export const postAdminRecommendationStateController = async (
  req: Request,
  res: Response
) => {
  try {
    const user = (req as any).user;
    const guard = adminGuard(user, res);
    if (guard == null) return;
    const { entId } = guard;

    const recommendationId = String(req.body?.recommendationId ?? "").trim();
    const status = String(req.body?.status ?? "").trim().toLowerCase();
    if (!recommendationId) {
      return res.status(400).json({ message: "recommendationId requis" });
    }
    if (status !== "applied" && status !== "dismissed") {
      return res.status(400).json({ message: "status invalide" });
    }

    const actionType = String(req.body?.actionType ?? "").trim() || null;
    const title = String(req.body?.title ?? "").trim() || null;
    const resultSummary = String(req.body?.resultSummary ?? "").trim() || null;
    const projectId = Number(req.body?.projectId ?? 0) || null;
    const metadata =
      req.body?.metadata && typeof req.body.metadata === "object"
        ? (req.body.metadata as Record<string, unknown>)
        : null;

    await recordAdminRecommendationState({
      enterpriseId: entId,
      userId: Number(user.id),
      recommendationId,
      status: status as "applied" | "dismissed",
      actionType,
      title,
      resultSummary,
      metadata,
    });

    if (status === "applied" && title && resultSummary) {
      await logAdminRecommendationActivity({
        userName: activityUserName(user),
        enterpriseId: entId,
        recommendationTitle: title,
        actionType: actionType ?? "apply",
        resultSummary,
        projectId,
      });
    }

    return res.json({
      ok: true,
      recommendationId,
      status,
    });
  } catch (err) {
    console.error("postAdminRecommendationStateController error:", err);
    return res.status(500).json({
      message: "Impossible d'enregistrer l'état de la recommandation",
    });
  }
};
