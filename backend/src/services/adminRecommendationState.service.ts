import prisma from "../prisma/prismaClient";

export type AdminRecommendationStateStatus = "applied" | "dismissed";

export type AdminAppliedRecommendationRecord = {
  id: string;
  title: string;
  resultSummary: string | null;
  actionType: string | null;
  appliedAt: string;
  status: "applied";
  provider?: "groq" | "openai" | "data-driven" | null;
  scenario?: Record<string, unknown> | null;
};

const AI_FAIL_MESSAGE =
  "Impossible de générer les recommandations pour le moment.";

function isMissingStateTableError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  if (code === "P2021" || code === "P2022") return true;
  const msg = String((err as { message?: string })?.message ?? "").toLowerCase();
  return (
    msg.includes("admin_recommendation_state") &&
    (msg.includes("does not exist") || msg.includes("doesn't exist"))
  );
}

export async function getAppliedRecommendationRecords(
  enterpriseId: number,
  adminUserId: number
): Promise<AdminAppliedRecommendationRecord[]> {
  try {
    const rows = await prisma.admin_recommendation_state.findMany({
      where: {
        id_entreprise: enterpriseId,
        id_utilisateur: adminUserId,
        status: "applied",
      },
      orderBy: { createdAt: "desc" },
      select: {
        recommendation_id: true,
        title: true,
        result_summary: true,
        action_type: true,
        createdAt: true,
        metadata: true,
      },
    });

    return rows.map((row) => {
      const metadata =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null;
      const providerRaw = metadata?.provider;
      const provider =
        providerRaw === "groq" ||
        providerRaw === "openai" ||
        providerRaw === "data-driven"
          ? providerRaw
          : null;

      return {
        id: row.recommendation_id,
        title: row.title?.trim() || `Recommandation ${row.recommendation_id}`,
        resultSummary: row.result_summary,
        actionType: row.action_type,
        appliedAt: row.createdAt.toISOString(),
        status: "applied" as const,
        provider,
        scenario:
          metadata?.scenario && typeof metadata.scenario === "object"
            ? (metadata.scenario as Record<string, unknown>)
            : null,
      };
    });
  } catch (err) {
    if (isMissingStateTableError(err)) {
      return [];
    }
    console.error("[getAppliedRecommendationRecords]", err);
    return [];
  }
}

export async function getArchivedRecommendationIds(
  enterpriseId: number,
  adminUserId: number
): Promise<Set<string>> {
  try {
    const rows = await prisma.admin_recommendation_state.findMany({
      where: { id_entreprise: enterpriseId, id_utilisateur: adminUserId },
      select: { recommendation_id: true },
    });
    return new Set(rows.map((r) => r.recommendation_id));
  } catch (err) {
    if (isMissingStateTableError(err)) {
      console.warn(
        "[adminRecommendationState] Table admin_recommendation_state missing — run prisma migrate deploy"
      );
      return new Set();
    }
    console.error("[getArchivedRecommendationIds]", err);
    return new Set();
  }
}

export async function recordAdminRecommendationState(params: {
  enterpriseId: number;
  userId: number;
  recommendationId: string;
  status: AdminRecommendationStateStatus;
  actionType?: string | null;
  title?: string | null;
  resultSummary?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await prisma.admin_recommendation_state.upsert({
      where: {
        id_entreprise_recommendation_id: {
          id_entreprise: params.enterpriseId,
          recommendation_id: params.recommendationId,
        },
      },
      create: {
        id_entreprise: params.enterpriseId,
        id_utilisateur: params.userId,
        recommendation_id: params.recommendationId,
        status: params.status,
        action_type: params.actionType ?? null,
        title: params.title ?? null,
        result_summary: params.resultSummary ?? null,
        metadata: (params.metadata ?? undefined) as object | undefined,
      },
      update: {
        id_utilisateur: params.userId,
        status: params.status,
        action_type: params.actionType ?? null,
        title: params.title ?? null,
        result_summary: params.resultSummary ?? null,
        metadata: (params.metadata ?? undefined) as object | undefined,
      },
    });
  } catch (err) {
    if (isMissingStateTableError(err)) {
      console.warn(
        "[adminRecommendationState] Cannot persist state — table missing"
      );
      return;
    }
    console.error("[recordAdminRecommendationState]", err);
    throw err;
  }
}

export async function logAdminRecommendationActivity(params: {
  userName: string;
  enterpriseId: number;
  recommendationTitle: string;
  actionType: string;
  resultSummary: string;
  projectId?: number | null;
}): Promise<void> {
  const action = `Recommandation appliquée — ${params.recommendationTitle}`;
  const entreprise = `Entreprise:${params.enterpriseId}|Type:${params.actionType}|${params.resultSummary}`;

  try {
    await prisma.activity.create({
      data: {
        user: params.userName,
        action,
        entreprise,
        status: "ACTIVE",
        type: "info",
        entityId: params.projectId ?? null,
        date: new Date(),
      },
    });
  } catch (e) {
    console.error("[logAdminRecommendationActivity]", e);
  }
}

export { AI_FAIL_MESSAGE };
