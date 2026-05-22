import prisma from "../prisma/prismaClient";

export interface TenantAdminRiskSummary {
  totalAtRisk: number;
  weeklyDelta: number;
  subtitle: string;
  breakdown: {
    delayedProjects: number;
    blockedProjects: number;
    overdueProjectDeadlines: number;
    projectsWithOverdueTasks: number;
    highPriorityOpen: number;
  };
}

function normStatus(raw?: string | null): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\s-]/g, "_");
}

function isProjectCompleted(statut?: string | null): boolean {
  const s = normStatus(statut);
  return (
    s === "COMPLETED" ||
    s === "TERMINE" ||
    s === "TERMINEE" ||
    s === "LIVRE" ||
    s === "LIVREE"
  );
}

function isProjectDelayed(statut?: string | null): boolean {
  const s = normStatus(statut);
  return s === "DELAYED" || s === "EN_RETARD" || s === "RETARD";
}

function isProjectBlocked(statut?: string | null): boolean {
  const s = normStatus(statut);
  return s === "ON_HOLD" || s === "EN_ATTENTE" || s === "PAUSE" || s === "BLOQUE";
}

function isTaskDone(statut?: string | null): boolean {
  const s = normStatus(statut);
  return (
    s === "DONE" ||
    s === "TERMINE" ||
    s === "TERMINEE" ||
    s === "COMPLETE" ||
    s === "COMPLETED"
  );
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isTaskOverdue(
  statut: string | null | undefined,
  dateLimite: Date | null | undefined,
  now: Date
): boolean {
  if (isTaskDone(statut) || !dateLimite) return false;
  return startOfDay(dateLimite).getTime() < startOfDay(now).getTime();
}

function isHighPriority(priority?: string | null): boolean {
  const p = normStatus(priority);
  return p === "HIGH" || p === "HAUTE" || p === "URGENT" || p === "URGENTE";
}

function isProjectDeadlineOverdue(
  dateFin: Date | null | undefined,
  statut: string | null | undefined,
  now: Date
): boolean {
  if (!dateFin || isProjectCompleted(statut)) return false;
  return startOfDay(dateFin).getTime() < startOfDay(now).getTime();
}

/**
 * Enterprise-scoped risk summary for tenant admin dashboard KPI.
 */
export async function getTenantAdminRiskSummary(
  enterpriseId: number
): Promise<TenantAdminRiskSummary> {
  const now = new Date();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weekAgo = new Date(now.getTime() - weekMs);
  const twoWeeksAgo = new Date(now.getTime() - weekMs * 2);

  const [projects, tasks] = await Promise.all([
    prisma.projet.findMany({
      where: { id_entreprise: enterpriseId },
      select: {
        id_projet: true,
        statut_p: true,
        date_fin: true,
        createdAt: true,
      },
    }),
    prisma.tache.findMany({
      where: { projet: { id_entreprise: enterpriseId } },
      select: {
        id_tache: true,
        id_projet: true,
        statut_t: true,
        priorite_t: true,
        date_limite_t: true,
      },
    }),
  ]);

  const tasksByProject = new Map<number, typeof tasks>();
  for (const t of tasks) {
    if (!t.id_projet) continue;
    const list = tasksByProject.get(t.id_projet) ?? [];
    list.push(t);
    tasksByProject.set(t.id_projet, list);
  }

  const atRiskProjectIds = new Set<number>();
  let riskSignalsThisWeek = 0;
  let riskSignalsLastWeek = 0;

  let delayedProjects = 0;
  let blockedProjects = 0;
  let overdueProjectDeadlines = 0;
  let projectsWithOverdueTasks = 0;
  let highPriorityOpen = 0;

  for (const p of projects) {
    const pid = p.id_projet;
    const projectTasks = tasksByProject.get(pid) ?? [];
    const reasons: { at: Date }[] = [];

    if (isProjectDelayed(p.statut_p)) {
      delayedProjects += 1;
      reasons.push({ at: p.createdAt ?? now });
    }
    if (isProjectBlocked(p.statut_p)) {
      blockedProjects += 1;
      reasons.push({ at: p.createdAt ?? now });
    }
    if (isProjectDeadlineOverdue(p.date_fin, p.statut_p, now)) {
      overdueProjectDeadlines += 1;
      reasons.push({ at: p.date_fin ?? now });
    }

    let hasOverdueTask = false;
    for (const t of projectTasks) {
      if (isTaskOverdue(t.statut_t, t.date_limite_t, now)) {
        hasOverdueTask = true;
        reasons.push({ at: t.date_limite_t ?? now });
      }
      if (!isTaskDone(t.statut_t) && isHighPriority(t.priorite_t)) {
        highPriorityOpen += 1;
        reasons.push({ at: t.date_limite_t ?? now });
      }
    }
    if (hasOverdueTask) {
      projectsWithOverdueTasks += 1;
    }

    if (reasons.length > 0) {
      atRiskProjectIds.add(pid);
      const latestSignal = reasons.reduce<Date>(
        (max, r) => (r.at.getTime() > max.getTime() ? r.at : max),
        reasons[0].at
      );
      const t = latestSignal.getTime();
      if (t >= weekAgo.getTime()) riskSignalsThisWeek += 1;
      else if (t >= twoWeeksAgo.getTime()) riskSignalsLastWeek += 1;
    }
  }

  const totalAtRisk = atRiskProjectIds.size;
  const weeklyDelta = riskSignalsThisWeek - riskSignalsLastWeek;

  return {
    totalAtRisk,
    weeklyDelta,
    subtitle: "Projets en retard ou bloqués",
    breakdown: {
      delayedProjects,
      blockedProjects,
      overdueProjectDeadlines,
      projectsWithOverdueTasks,
      highPriorityOpen,
    },
  };
}
