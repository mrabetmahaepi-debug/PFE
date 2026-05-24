import prisma from "../prisma/prismaClient";
import { isPastDueCalendar } from "./taskDueCalendar";

/** Kanban workflow columns (order matters for UI). */
export const WORKFLOW_STATUT_KEYS = [
  "todo",
  "en_cours",
  "en_retard",
  "terminee",
] as const;

export type WorkflowStatutKey = (typeof WORKFLOW_STATUT_KEYS)[number];

const DONE_KEYS = new Set([
  "terminee",
  "done",
  "terminé",
  "terminée",
  "termine",
  "acheve",
  "achevé",
]);

/**
 * Normalize free-text / legacy task status to a stable slug.
 */
export function normalizeStatutKey(
  statut?: string | null | undefined
): string {
  if (!statut || !String(statut).trim()) return "todo";
  const raw = String(statut).trim();
  const lower = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  const upper = raw.toUpperCase().replace(/\s+/g, "_");

  if (
    upper === "TODO" ||
    upper === "TO_DO" ||
    lower === "todo" ||
    lower === "a_faire" ||
    lower === "à_faire"
  ) {
    return "todo";
  }
  if (
    upper === "IN_PROGRESS" ||
    upper === "EN_COURS" ||
    lower === "en_cours"
  ) {
    return "en_cours";
  }
  if (
    upper === "EN_RETARD" ||
    lower === "en_retard" ||
    lower === "overdue" ||
    upper === "OVERDUE"
  ) {
    return "en_retard";
  }
  if (
    DONE_KEYS.has(lower) ||
    upper === "DONE" ||
    upper === "TERMINEE" ||
    upper === "TERMINE" ||
    upper === "ACHEVE"
  ) {
    return "terminee";
  }
  if (/^[a-z][a-z0-9_]{0,48}$/i.test(lower)) return lower;
  return "todo";
}

export function isCompletedStatut(statut?: string | null): boolean {
  return normalizeStatutKey(statut) === "terminee";
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isPastDueDate(
  dateLimite?: Date | string | null,
  now: Date = new Date()
): boolean {
  return isPastDueCalendar(dateLimite, now);
}

/**
 * Resolve `statut_t` after user input or automatic sync.
 */
export function resolveWorkflowStatut(
  currentStatut: string | null | undefined,
  dateLimite: Date | string | null | undefined,
  requestedStatut?: string | null | undefined,
  opts?: { userExplicitStatut?: boolean }
): WorkflowStatutKey {
  const cur = normalizeStatutKey(currentStatut);
  const req =
    requestedStatut !== undefined &&
    requestedStatut !== null &&
    String(requestedStatut).trim() !== ""
      ? normalizeStatutKey(requestedStatut)
      : undefined;

  const pastDue = isPastDueDate(dateLimite);

  if (opts?.userExplicitStatut && req !== undefined) {
    if (req === "terminee") return "terminee";
    if (req === "en_retard") return "en_retard";
    if (pastDue && (req === "todo" || req === "en_cours")) return "en_retard";
    if (!pastDue && req === "en_retard") return "en_cours";
    if (req === "en_cours" || req === "todo") return req;
    return "todo";
  }

  const base = req ?? cur;
  if (isCompletedStatut(base)) return "terminee";
  if (pastDue) return "en_retard";
  if (base === "en_retard") return "en_cours";
  if (base === "en_cours") return "en_cours";
  if (base === "todo") return "todo";
  return "todo";
}

type TaskRow = {
  id_tache: number;
  statut_t: string | null;
  date_limite_t: Date | null;
};

/** Persist overdue transitions for loaded tasks; returns updated rows. */
export async function syncOverdueForTasks<T extends TaskRow>(
  tasks: T[]
): Promise<T[]> {
  if (tasks.length === 0) return tasks;

  const updates: { id: number; statut: WorkflowStatutKey }[] = [];

  for (const t of tasks) {
    const next = resolveWorkflowStatut(
      t.statut_t,
      t.date_limite_t,
      undefined,
      { userExplicitStatut: false }
    );
    const cur = normalizeStatutKey(t.statut_t);
    if (next !== cur) {
      updates.push({ id: t.id_tache, statut: next });
    }
  }

  if (updates.length === 0) return tasks;

  await Promise.all(
    updates.map((u) =>
      prisma.tache.update({
        where: { id_tache: u.id },
        data: {
          statut_t: u.statut,
          ...(u.statut === "terminee" ? { date_fin_t: new Date() } : {}),
        },
      })
    )
  );

  const byId = new Map(updates.map((u) => [u.id, u.statut]));
  return tasks.map((t) =>
    byId.has(t.id_tache) ? { ...t, statut_t: byId.get(t.id_tache)! } : t
  );
}
