export type AdminRecommendationActionType =
  | "add_member"
  | "assign_member"
  | "review_tasks"
  | "redistribute_workload"
  | "update_timeline"
  | "create_sprint"
  | "update_project_status"
  | "open_portfolio";

const ACTION_TYPES = new Set<AdminRecommendationActionType>([
  "add_member",
  "assign_member",
  "review_tasks",
  "redistribute_workload",
  "update_timeline",
  "create_sprint",
  "update_project_status",
  "open_portfolio",
]);

export function normalizeActionType(raw: unknown): AdminRecommendationActionType | null {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (ACTION_TYPES.has(key as AdminRecommendationActionType)) {
    return key as AdminRecommendationActionType;
  }
  return null;
}

export function parseRecommendationEntities(id: string): {
  projectId?: number;
  memberId?: number;
} {
  const delay = id.match(/^delay-(\d+)$/);
  if (delay) return { projectId: Number(delay[1]) };
  const deadline = id.match(/^deadline-(\d+)$/);
  if (deadline) return { projectId: Number(deadline[1]) };
  const team = id.match(/^team-(\d+)$/);
  if (team) return { projectId: Number(team[1]) };
  const inactive = id.match(/^inactive-(\d+)$/);
  if (inactive) return { projectId: Number(inactive[1]) };
  const blocked = id.match(/^blocked-(\d+)$/);
  if (blocked) return { projectId: Number(blocked[1]) };
  const workload = id.match(/^workload-(\d+)$/);
  if (workload) return { memberId: Number(workload[1]) };
  const unassigned = id.match(/^unassigned-(\d+)$/);
  if (unassigned) return { memberId: Number(unassigned[1]) };
  return {};
}

export function inferActionType(
  id: string,
  suggestedAction: string,
  explanation: string
): AdminRecommendationActionType {
  const fromId = id.toLowerCase();
  if (fromId.startsWith("team-")) return "add_member";
  if (fromId.startsWith("unassigned-")) return "assign_member";
  if (fromId.startsWith("workload-")) return "redistribute_workload";
  if (fromId.startsWith("delay-")) return "review_tasks";
  if (fromId.startsWith("deadline-")) return "create_sprint";
  if (fromId.startsWith("inactive-")) return "update_project_status";
  if (fromId.startsWith("blocked-")) return "update_project_status";
  if (fromId === "overdue-portfolio") return "review_tasks";

  const text = `${suggestedAction} ${explanation}`.toLowerCase();
  if (/ajouter un membre|renfort|membre suppl/i.test(text)) return "add_member";
  if (/affecter|assigner.*membre|disponible/i.test(text)) return "assign_member";
  if (/redistribu|charge|surcharge/i.test(text)) return "redistribute_workload";
  if (/sprint/i.test(text)) return "create_sprint";
  if (/échéance|timeline|date|planning/i.test(text)) return "update_timeline";
  if (/statut|inactif|bloqu/i.test(text)) return "update_project_status";
  if (/tâche|retard|review|réévalu/i.test(text)) return "review_tasks";
  return "open_portfolio";
}
