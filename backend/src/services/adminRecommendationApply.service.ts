import prisma from "../prisma/prismaClient";
import {
  inferActionType,
  parseRecommendationEntities,
  type AdminRecommendationActionType,
} from "../lib/adminRecommendationAction";
import {
  isMemberInAdminScope,
  isProjectInAdminScope,
  loadAdminRecommendationScope,
} from "../lib/adminRecommendationScope";
import type { AdminRecommendationItem } from "./adminRecommendations.service";

export type AdminApplyTaskRow = {
  id: number;
  name: string;
  projectId: number;
  projectName: string;
  assigneeId: number | null;
  assigneeName: string | null;
  dueDate: string | null;
};

export type AdminApplyMemberRow = {
  id: number;
  name: string;
  email: string;
  openTasks: number;
};

export type AdminApplyReassignment = {
  taskId: number;
  taskName: string;
  fromMemberId: number;
  fromMemberName: string;
  toMemberId: number;
  toMemberName: string;
};

export type AdminApplyProjectOption = {
  id: number;
  name: string;
  openTasks: number;
  memberCount: number;
};

export type AdminApplyContext = {
  actionType: AdminRecommendationActionType;
  projectId?: number | null;
  memberId?: number | null;
  project?: {
    id: number;
    name: string;
    status: string | null;
    dateDebut: string | null;
    dateFin: string | null;
    chefId: number | null;
    teamMemberIds: number[];
  };
  member?: { id: number; name: string };
  overdueTasks: AdminApplyTaskRow[];
  teamCandidates: AdminApplyMemberRow[];
  suggestedReassignments: AdminApplyReassignment[];
  suggestedProjects: AdminApplyProjectOption[];
  suggestedSprint?: {
    name: string;
    dateDebut: string;
    dateFin: string;
    idProjet: number;
  };
  suggestedStatus?: string;
};

export class AdminRecommendationScopeError extends Error {
  constructor(message = "Ressource hors de votre espace de travail") {
    super(message);
    this.name = "AdminRecommendationScopeError";
  }
}

function memberName(u: {
  prenom?: string | null;
  nom?: string | null;
  email?: string | null;
}): string {
  const full = [u.prenom, u.nom].filter(Boolean).join(" ").trim();
  if (full) return full;
  return u.email?.split("@")[0] || "Membre";
}

function isTaskDone(statut?: string | null): boolean {
  const s = String(statut ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return (
    s.includes("done") ||
    s.includes("termine") ||
    s.includes("complete")
  );
}

function isTaskOverdue(
  statut: string | null | undefined,
  dateLimite: Date | null | undefined,
  now: Date
): boolean {
  if (isTaskDone(statut) || !dateLimite) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateLimite);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function resolveRecommendationAction(
  rec: Pick<
    AdminRecommendationItem,
    "id" | "actionType" | "projectId" | "memberId" | "suggestedAction" | "explanation"
  >
): AdminRecommendationActionType {
  if (rec.actionType) return rec.actionType;
  return inferActionType(rec.id, rec.suggestedAction, rec.explanation);
}

export async function getAdminRecommendationApplyContext(
  enterpriseId: number,
  adminUserId: number,
  rec: Pick<
    AdminRecommendationItem,
    "id" | "actionType" | "projectId" | "memberId" | "suggestedAction" | "explanation"
  >
): Promise<AdminApplyContext> {
  const now = new Date();
  const parsed = parseRecommendationEntities(rec.id);
  const actionType = resolveRecommendationAction(rec);
  const projectId = rec.projectId ?? parsed.projectId ?? null;
  const memberId = rec.memberId ?? parsed.memberId ?? null;

  const scope = await loadAdminRecommendationScope(enterpriseId, adminUserId);
  const projectIds = [...scope.projectIds];

  if (projectId != null && !isProjectInAdminScope(projectId, scope)) {
    throw new AdminRecommendationScopeError();
  }

  if (projectIds.length === 0) {
    return {
      actionType,
      projectId,
      memberId,
      overdueTasks: [],
      teamCandidates: [],
      suggestedReassignments: [],
      suggestedProjects: [],
    };
  }

  const [members, projects] = await Promise.all([
    prisma.utilisateur.findMany({
      where: {
        id_entreprise: enterpriseId,
        OR: [
          { membre_projet: { some: { id_projet: { in: projectIds } } } },
          {
            taches_assignees: {
              some: { deleted_at: null, id_projet: { in: projectIds } },
            },
          },
        ],
      },
      select: {
        id_utilisateur: true,
        prenom: true,
        nom: true,
        email: true,
        statut: true,
        taches_assignees: {
          where: { deleted_at: null, id_projet: { in: projectIds } },
          select: { id_tache: true, statut_t: true },
        },
      },
    }),
    prisma.projet.findMany({
      where: {
        id_projet: { in: projectIds },
        id_entreprise: enterpriseId,
        deleted_at: null,
      },
      select: {
        id_projet: true,
        nom_p: true,
        statut_p: true,
        date_debut: true,
        date_fin: true,
        chef_de_projet_id: true,
        membre_projet: { select: { id_utilisateur: true } },
        _count: { select: { membre_projet: true, tache: true } },
      },
    }),
  ]);

  const scopedMemberIds = new Set(members.map((m) => m.id_utilisateur));
  if (memberId != null && !isMemberInAdminScope(memberId, scopedMemberIds)) {
    throw new AdminRecommendationScopeError();
  }

  const openTaskCountByMember = new Map<number, number>();
  for (const m of members) {
    const open = m.taches_assignees.filter((t) => !isTaskDone(t.statut_t)).length;
    openTaskCountByMember.set(m.id_utilisateur, open);
  }

  const teamCandidates: AdminApplyMemberRow[] = members
    .filter((m) => {
      const st = String(m.statut ?? "").toUpperCase();
      return st !== "PENDING" && st !== "INVITATION_PENDING";
    })
    .map((m) => ({
      id: m.id_utilisateur,
      name: memberName(m),
      email: m.email ?? "",
      openTasks: openTaskCountByMember.get(m.id_utilisateur) ?? 0,
    }))
    .sort((a, b) => a.openTasks - b.openTasks);

  let project:
    | AdminApplyContext["project"]
    | undefined;
  if (projectId) {
    const p = projects.find((row) => row.id_projet === projectId);
    if (p) {
      project = {
        id: p.id_projet,
        name: p.nom_p?.trim() || `Projet #${p.id_projet}`,
        status: p.statut_p,
        dateDebut: p.date_debut ? toDateInput(p.date_debut) : null,
        dateFin: p.date_fin ? toDateInput(p.date_fin) : null,
        chefId: p.chef_de_projet_id,
        teamMemberIds: p.membre_projet.map((mp) => mp.id_utilisateur),
      };
    }
  }

  let member: AdminApplyContext["member"] | undefined;
  if (memberId) {
    const m = members.find((row) => row.id_utilisateur === memberId);
    if (m) {
      member = { id: m.id_utilisateur, name: memberName(m) };
    }
  }

  const scopedTaskFilter = { id_projet: { in: projectIds } };
  const taskWhere =
    actionType === "review_tasks" && projectId
      ? { id_projet: projectId }
      : actionType === "redistribute_workload" && memberId
        ? { assigne_a: memberId, ...scopedTaskFilter }
        : actionType === "review_tasks"
          ? scopedTaskFilter
          : projectId
            ? { id_projet: projectId }
            : scopedTaskFilter;

  const tasks = await prisma.tache.findMany({
    where: {
      deleted_at: null,
      ...taskWhere,
      projet: { id_entreprise: enterpriseId, deleted_at: null },
    },
    select: {
      id_tache: true,
      nom_t: true,
      statut_t: true,
      date_limite_t: true,
      assigne_a: true,
      id_projet: true,
      utilisateur: {
        select: { id_utilisateur: true, prenom: true, nom: true, email: true },
      },
      projet: { select: { id_projet: true, nom_p: true } },
    },
    take: 40,
    orderBy: { date_limite_t: "asc" },
  });

  const overdueTasks: AdminApplyTaskRow[] = tasks
    .filter((t) => isTaskOverdue(t.statut_t, t.date_limite_t, now))
    .map((t) => ({
      id: t.id_tache,
      name: t.nom_t?.trim() || `Tâche #${t.id_tache}`,
      projectId: t.id_projet ?? 0,
      projectName: t.projet?.nom_p?.trim() || "Projet",
      assigneeId: t.assigne_a,
      assigneeName: t.utilisateur ? memberName(t.utilisateur) : null,
      dueDate: t.date_limite_t ? toDateInput(t.date_limite_t) : null,
    }));

  const openTasksForMember: AdminApplyTaskRow[] = tasks
    .filter((t) => !isTaskDone(t.statut_t))
    .map((t) => ({
      id: t.id_tache,
      name: t.nom_t?.trim() || `Tâche #${t.id_tache}`,
      projectId: t.id_projet ?? 0,
      projectName: t.projet?.nom_p?.trim() || "Projet",
      assigneeId: t.assigne_a,
      assigneeName: t.utilisateur ? memberName(t.utilisateur) : null,
      dueDate: t.date_limite_t ? toDateInput(t.date_limite_t) : null,
    }));

  const reassignSource =
    actionType === "redistribute_workload"
      ? openTasksForMember.length > 0
        ? openTasksForMember
        : overdueTasks
      : overdueTasks;

  const suggestedReassignments: AdminApplyReassignment[] = [];
  if (actionType === "redistribute_workload" && memberId) {
    const targets = teamCandidates
      .filter((c) => c.id !== memberId && c.openTasks < 6)
      .slice(0, 3);
    let targetIdx = 0;
    for (const task of reassignSource.slice(0, 8)) {
      const target = targets[targetIdx % Math.max(targets.length, 1)];
      if (!target) break;
      suggestedReassignments.push({
        taskId: task.id,
        taskName: task.name,
        fromMemberId: memberId,
        fromMemberName: member?.name ?? "Membre",
        toMemberId: target.id,
        toMemberName: target.name,
      });
      targetIdx += 1;
    }
  }

  const projectOpenTasks = new Map<number, number>();
  for (const t of tasks) {
    if (!t.id_projet || isTaskDone(t.statut_t)) continue;
    projectOpenTasks.set(
      t.id_projet,
      (projectOpenTasks.get(t.id_projet) ?? 0) + 1
    );
  }

  const suggestedProjects: AdminApplyProjectOption[] = projects
    .map((p) => ({
      id: p.id_projet,
      name: p.nom_p?.trim() || `Projet #${p.id_projet}`,
      openTasks: projectOpenTasks.get(p.id_projet) ?? 0,
      memberCount: p._count.membre_projet,
    }))
    .filter((p) => p.openTasks > 0)
    .sort((a, b) => b.openTasks - a.openTasks || a.memberCount - b.memberCount)
    .slice(0, 8);

  let suggestedSprint: AdminApplyContext["suggestedSprint"];
  if (
    (actionType === "create_sprint" || actionType === "update_timeline") &&
    projectId &&
    project
  ) {
    const start = new Date(now);
    const end = new Date(now);
    end.setDate(end.getDate() + 14);
    suggestedSprint = {
      name: `Sprint — ${project.name}`.slice(0, 100),
      dateDebut: toDateInput(start),
      dateFin: toDateInput(end),
      idProjet: projectId,
    };
  }

  let suggestedStatus: string | undefined;
  if (actionType === "update_project_status") {
    suggestedStatus =
      rec.id.startsWith("blocked-") || /bloqu/i.test(rec.explanation)
        ? "IN_PROGRESS"
        : "IN_PROGRESS";
  }

  return {
    actionType,
    projectId,
    memberId,
    project,
    member,
    overdueTasks,
    teamCandidates,
    suggestedReassignments,
    suggestedProjects,
    suggestedSprint,
    suggestedStatus,
  };
}
