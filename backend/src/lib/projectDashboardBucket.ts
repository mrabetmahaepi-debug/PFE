import type { ProjectTaskStats } from "./projectTaskStats";

export type ProjectDashboardBucket =
  | "planning"
  | "in_progress"
  | "completed"
  | "delayed";

function normalizeProjectStatusKey(statut?: string | null): string {
  return String(statut ?? "PLANNING")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]/g, "_");
}

function isCompletedStatus(statut?: string | null): boolean {
  const s = normalizeProjectStatusKey(statut);
  return (
    s === "COMPLETED" ||
    s === "TERMINE" ||
    s === "TERMINEE" ||
    s === "LIVRE" ||
    s === "LIVREE"
  );
}

function isDelayedStatus(statut?: string | null): boolean {
  const s = normalizeProjectStatusKey(statut);
  return s === "DELAYED" || s === "EN_RETARD" || s === "RETARD";
}

function isInProgressStatus(statut?: string | null): boolean {
  const s = normalizeProjectStatusKey(statut);
  return (
    s === "IN_PROGRESS" ||
    s === "EN_COURS" ||
    s === "ACTIVE" ||
    s === "ACTIF"
  );
}

/** Classify project for admin dashboard charts from real task stats + optional statut_p. */
export function resolveProjectDashboardBucket(
  stats: Pick<
    ProjectTaskStats,
    | "totalTasks"
    | "completedTasks"
    | "inProgressTasks"
    | "lateTasks"
    | "avancement"
  >,
  statut_p?: string | null
): ProjectDashboardBucket {
  const total = stats.totalTasks ?? 0;
  const completed = stats.completedTasks ?? 0;
  const progress = stats.avancement ?? 0;

  if (
    (total > 0 && completed >= total) ||
    progress >= 100 ||
    isCompletedStatus(statut_p)
  ) {
    return "completed";
  }

  if ((stats.lateTasks ?? 0) > 0 || isDelayedStatus(statut_p)) {
    return "delayed";
  }

  if (
    progress > 0 ||
    (stats.inProgressTasks ?? 0) > 0 ||
    isInProgressStatus(statut_p)
  ) {
    return "in_progress";
  }

  return "planning";
}
