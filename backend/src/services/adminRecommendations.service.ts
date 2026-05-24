import prisma from "../prisma/prismaClient";
import {
  inferActionType,
  normalizeActionType,
  parseRecommendationEntities,
  type AdminRecommendationActionType,
} from "../lib/adminRecommendationAction";
import {
  getAdminManagedProjectIds,
  isMemberInAdminScope,
  isProjectInAdminScope,
  loadAdminRecommendationScope,
  type AdminRecommendationScope,
} from "../lib/adminRecommendationScope";
import {
  AI_FAIL_MESSAGE,
  getArchivedRecommendationIds,
} from "./adminRecommendationState.service";
import {
  invokeLlm,
  isTaskAssistantConfigured,
  NOT_CONFIGURED_MSG,
} from "./taskAssistant.service";

export type AdminRecommendationPriority = "faible" | "moyenne" | "elevee";

export type { AdminRecommendationActionType };

export type AdminRecommendationItem = {
  id: string;
  title: string;
  explanation: string;
  priority: AdminRecommendationPriority;
  suggestedAction: string;
  actionPath: string;
  actionType: AdminRecommendationActionType;
  projectId?: number | null;
  memberId?: number | null;
  date: string;
};

export type AdminRecommendationsResult = {
  success: boolean;
  recommendations: AdminRecommendationItem[];
  provider: "groq" | "openai" | "data-driven" | null;
  generatedAt: string;
  configured: boolean;
  message?: string;
};

type PortfolioSnapshot = {
  generatedAt: string;
  summary: {
    totalProjects: number;
    activeProjects: number;
    totalTasks: number;
    openTasks: number;
    overdueTasks: number;
    blockedOrDelayedProjects: number;
    membersWithoutTasks: number;
  };
  projects: Array<{
    id: number;
    name: string;
    status: string;
    deadline: string | null;
    daysUntilDeadline: number | null;
    memberCount: number;
    totalTasks: number;
    openTasks: number;
    doneTasks: number;
    overdueTasks: number;
    progressPercent: number;
    lastActivity: string | null;
    inactiveDays: number | null;
  }>;
  members: Array<{
    id: number;
    name: string;
    role: string | null;
    projectCount: number;
    assignedOpenTasks: number;
    overdueTasks: number;
  }>;
};

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

function daysUntil(dateRaw: Date | null | undefined, now: Date): number | null {
  if (!dateRaw) return null;
  const end = new Date(dateRaw);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function daysSince(dateRaw: Date | null | undefined, now: Date): number | null {
  if (!dateRaw) return null;
  const d = new Date(dateRaw);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function memberName(
  u: { prenom?: string | null; nom?: string | null; email?: string | null }
): string {
  const full = [u.prenom, u.nom].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (u.email?.trim()) return u.email.split("@")[0] || "Membre";
  return "Membre";
}

function normalizePriority(raw: unknown): AdminRecommendationPriority {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (s === "elevee" || s === "élevée" || s === "haute" || s === "urgent") {
    return "elevee";
  }
  if (s === "moyenne" || s === "medium") return "moyenne";
  return "faible";
}

function extractJsonBlock(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const brace = raw.match(/\{[\s\S]*\}/);
  if (brace?.[0]) return brace[0];
  return raw.trim();
}

function priorityOrder(p: AdminRecommendationPriority): number {
  return p === "elevee" ? 0 : p === "moyenne" ? 1 : 2;
}

function sortRecommendations(
  items: AdminRecommendationItem[]
): AdminRecommendationItem[] {
  return [...items].sort((a, b) => {
    const byPriority = priorityOrder(a.priority) - priorityOrder(b.priority);
    if (byPriority !== 0) return byPriority;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

function emptySnapshot(generatedAt: string): PortfolioSnapshot {
  return {
    generatedAt,
    summary: {
      totalProjects: 0,
      activeProjects: 0,
      totalTasks: 0,
      openTasks: 0,
      overdueTasks: 0,
      blockedOrDelayedProjects: 0,
      membersWithoutTasks: 0,
    },
    projects: [],
    members: [],
  };
}

export async function loadAdminPortfolioSnapshot(
  enterpriseId: number,
  adminUserId: number
): Promise<PortfolioSnapshot> {
  const now = new Date();
  const generatedAt = now.toISOString();

  if (
    !Number.isFinite(enterpriseId) ||
    enterpriseId <= 0 ||
    !Number.isFinite(adminUserId) ||
    adminUserId <= 0
  ) {
    return emptySnapshot(generatedAt);
  }

  let projectIds: number[] = [];
  try {
    projectIds = await getAdminManagedProjectIds(enterpriseId, adminUserId);
  } catch (err) {
    console.error("[loadAdminPortfolioSnapshot] scope error:", err);
    return emptySnapshot(generatedAt);
  }

  if (projectIds.length === 0) {
    return emptySnapshot(generatedAt);
  }

  let projects: Array<{
    id_projet: number;
    nom_p: string | null;
    statut_p: string | null;
    date_fin: Date | null;
    date_debut: Date | null;
    createdAt: Date;
    _count: { membre_projet: number; tache: number };
  }> = [];
  let tasks: Array<{
    id_tache: number;
    id_projet: number | null;
    statut_t: string | null;
    date_limite_t: Date | null;
    date_fin_t: Date | null;
    assigne_a: number | null;
  }> = [];
  let members: Array<{
    id_utilisateur: number;
    prenom: string | null;
    nom: string | null;
    email: string | null;
    poste: string | null;
    statut: string | null;
    lastSeen: Date | null;
    membre_projet: { id_projet: number }[];
  }> = [];

  try {
    [projects, tasks] = await Promise.all([
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
          date_fin: true,
          date_debut: true,
          createdAt: true,
          _count: { select: { membre_projet: true, tache: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.tache.findMany({
        where: {
          deleted_at: null,
          id_projet: { in: projectIds },
        },
        select: {
          id_tache: true,
          id_projet: true,
          statut_t: true,
          date_limite_t: true,
          date_fin_t: true,
          assigne_a: true,
        },
      }),
    ]);

    const memberIdSet = new Set<number>();
    for (const t of tasks) {
      if (t.assigne_a) memberIdSet.add(t.assigne_a);
    }

    const projectMembers = await prisma.membre_projet.findMany({
      where: { id_projet: { in: projectIds } },
      select: { id_utilisateur: true },
    });
    for (const mp of projectMembers) {
      memberIdSet.add(mp.id_utilisateur);
    }

  members =
      memberIdSet.size > 0
        ? await prisma.utilisateur.findMany({
            where: {
              id_utilisateur: { in: [...memberIdSet] },
              id_entreprise: enterpriseId,
            },
            select: {
              id_utilisateur: true,
              prenom: true,
              nom: true,
              email: true,
              poste: true,
              statut: true,
              lastSeen: true,
              membre_projet: {
                where: { id_projet: { in: projectIds } },
                select: { id_projet: true },
              },
            },
          })
        : [];
  } catch (err) {
    console.error("[loadAdminPortfolioSnapshot] query error:", err);
    return emptySnapshot(generatedAt);
  }

  const tasksByProject = new Map<number, typeof tasks>();
  for (const t of tasks) {
    if (!t.id_projet) continue;
    const list = tasksByProject.get(t.id_projet) ?? [];
    list.push(t);
    tasksByProject.set(t.id_projet, list);
  }

  const openTasksByMember = new Map<number, number>();
  const overdueByMember = new Map<number, number>();
  let openTasks = 0;
  let overdueTasks = 0;

  for (const t of tasks) {
    if (isTaskDone(t.statut_t)) continue;
    openTasks += 1;
    if (t.assigne_a) {
      openTasksByMember.set(
        t.assigne_a,
        (openTasksByMember.get(t.assigne_a) ?? 0) + 1
      );
    }
    if (isTaskOverdue(t.statut_t, t.date_limite_t, now)) {
      overdueTasks += 1;
      if (t.assigne_a) {
        overdueByMember.set(
          t.assigne_a,
          (overdueByMember.get(t.assigne_a) ?? 0) + 1
        );
      }
    }
  }

  const projectRows = projects.map((p) => {
    const projectTasks = tasksByProject.get(p.id_projet) ?? [];
    const doneTasks = projectTasks.filter((t) => isTaskDone(t.statut_t)).length;
    const openProjectTasks = projectTasks.length - doneTasks;
    const overdueProjectTasks = projectTasks.filter((t) =>
      isTaskOverdue(t.statut_t, t.date_limite_t, now)
    ).length;
    const totalTasks = projectTasks.length;
    const progressPercent =
      totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    const lastTaskUpdate = projectTasks.reduce<Date | null>((max, t) => {
      const candidate = t.date_fin_t ?? t.date_limite_t;
      if (!candidate) return max;
      if (!max || candidate.getTime() > max.getTime()) return candidate;
      return max;
    }, null);
    const lastActivity = lastTaskUpdate ?? p.date_debut ?? p.createdAt;

    return {
      id: p.id_projet,
      name: p.nom_p?.trim() || `Projet #${p.id_projet}`,
      status: p.statut_p?.trim() || "—",
      deadline: p.date_fin ? p.date_fin.toISOString().slice(0, 10) : null,
      daysUntilDeadline: daysUntil(p.date_fin, now),
      memberCount: p._count.membre_projet,
      totalTasks,
      openTasks: openProjectTasks,
      doneTasks,
      overdueTasks: overdueProjectTasks,
      progressPercent,
      lastActivity: lastActivity ? lastActivity.toISOString() : null,
      inactiveDays: daysSince(lastActivity, now),
    };
  });

  const memberRows = members
    .filter((m) => {
      const status = normStatus(m.statut);
      return status !== "INVITATION_PENDING" && status !== "PENDING";
    })
    .map((m) => ({
      id: m.id_utilisateur,
      name: memberName(m),
      role: m.poste?.trim() || null,
      projectCount: m.membre_projet.length,
      assignedOpenTasks: openTasksByMember.get(m.id_utilisateur) ?? 0,
      overdueTasks: overdueByMember.get(m.id_utilisateur) ?? 0,
    }));

  const activeProjects = projects.filter((p) => !isProjectCompleted(p.statut_p));
  const blockedOrDelayed = activeProjects.filter(
    (p) => isProjectDelayed(p.statut_p) || isProjectBlocked(p.statut_p)
  ).length;
  const membersWithoutTasks = memberRows.filter(
    (m) => m.assignedOpenTasks === 0
  ).length;

  return {
    generatedAt,
    summary: {
      totalProjects: projects.length,
      activeProjects: activeProjects.length,
      totalTasks: tasks.length,
      openTasks,
      overdueTasks,
      blockedOrDelayedProjects: blockedOrDelayed,
      membersWithoutTasks,
    },
    projects: projectRows,
    members: memberRows,
  };
}

function buildPortfolioContextText(snapshot: PortfolioSnapshot): string {
  const lines: string[] = [
    `Date d'analyse : ${snapshot.generatedAt.slice(0, 10)}`,
    "Périmètre : espace de travail de l'administrateur connecté (projets qu'il gère uniquement).",
    "",
    "=== Synthèse ===",
    JSON.stringify(snapshot.summary, null, 2),
    "",
    "=== Projets ===",
    JSON.stringify(snapshot.projects.slice(0, 40), null, 2),
    "",
    "=== Membres (charge de travail) ===",
    JSON.stringify(snapshot.members.slice(0, 50), null, 2),
  ];
  return lines.join("\n");
}

function enrichRecommendation(
  partial: Omit<AdminRecommendationItem, "actionType" | "projectId" | "memberId"> & {
    actionType?: AdminRecommendationActionType;
    projectId?: number | null;
    memberId?: number | null;
  }
): AdminRecommendationItem {
  const entities = parseRecommendationEntities(partial.id);
  const projectId = partial.projectId ?? entities.projectId ?? null;
  const memberId = partial.memberId ?? entities.memberId ?? null;
  const actionType =
    partial.actionType ??
    inferActionType(partial.id, partial.suggestedAction, partial.explanation);

  return {
    ...partial,
    actionType,
    projectId,
    memberId,
  };
}

function sanitizeRecommendation(
  raw: Record<string, unknown>,
  index: number,
  generatedAt: string
): AdminRecommendationItem | null {
  const title = String(raw.title ?? raw.titre ?? "").trim();
  const explanation = String(
    raw.explanation ?? raw.description ?? raw.explication ?? ""
  ).trim();
  const suggestedAction = String(
    raw.suggestedAction ?? raw.action ?? raw.action_suggestee ?? ""
  ).trim();
  const actionPath = String(raw.actionPath ?? raw.action_path ?? "/projects").trim();
  if (!title || !explanation || !suggestedAction) return null;

  const id =
    String(raw.id ?? "").trim() ||
    `ai-rec-${index}-${title.slice(0, 24).replace(/\s+/g, "-").toLowerCase()}`;

  const projectIdRaw = Number(raw.projectId ?? raw.project_id ?? 0);
  const memberIdRaw = Number(raw.memberId ?? raw.member_id ?? 0);

  return enrichRecommendation({
    id,
    title,
    explanation,
    priority: normalizePriority(raw.priority ?? raw.priorite),
    suggestedAction,
    actionPath: actionPath.startsWith("/") ? actionPath : `/${actionPath}`,
    actionType: normalizeActionType(raw.actionType ?? raw.action_type) ?? undefined,
    projectId: Number.isFinite(projectIdRaw) && projectIdRaw > 0 ? projectIdRaw : null,
    memberId: Number.isFinite(memberIdRaw) && memberIdRaw > 0 ? memberIdRaw : null,
    date: generatedAt,
  });
}

function parseAiRecommendations(
  raw: string,
  generatedAt: string
): AdminRecommendationItem[] {
  try {
    const parsed = JSON.parse(extractJsonBlock(raw)) as Record<string, unknown>;
    const list = Array.isArray(parsed.recommendations)
      ? parsed.recommendations
      : Array.isArray(parsed)
        ? parsed
        : [];
    const items: AdminRecommendationItem[] = [];
    list.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return;
      const item = sanitizeRecommendation(
        entry as Record<string, unknown>,
        index,
        generatedAt
      );
      if (item) items.push(item);
    });
    return sortRecommendations(items).slice(0, 12);
  } catch {
    return [];
  }
}

function generateDataDrivenRecommendations(
  snapshot: PortfolioSnapshot
): AdminRecommendationItem[] {
  const items: AdminRecommendationItem[] = [];
  const { generatedAt } = snapshot;

  for (const project of snapshot.projects) {
    const statusNorm = normStatus(project.status);
    if (isProjectCompleted(project.status)) continue;

    if (isProjectDelayed(project.status) || project.overdueTasks >= 3) {
      items.push(
        enrichRecommendation({
          id: `delay-${project.id}`,
          title: `Risque de retard — ${project.name}`,
          explanation: `Le projet « ${project.name} » compte ${project.overdueTasks} tâche(s) en retard sur ${project.openTasks} ouverte(s). L'équipe (${project.memberCount} membre(s)) risque de ne pas tenir l'échéance.`,
          priority: project.overdueTasks >= 5 ? "elevee" : "moyenne",
          suggestedAction: "Réévaluer les tâches en retard et réassigner si nécessaire.",
          actionPath: `/projects/${project.id}`,
          actionType: "review_tasks",
          projectId: project.id,
          date: generatedAt,
        })
      );
    }

    if (
      project.daysUntilDeadline != null &&
      project.daysUntilDeadline >= 0 &&
      project.daysUntilDeadline <= 21 &&
      project.progressPercent < 60
    ) {
      items.push(
        enrichRecommendation({
          id: `deadline-${project.id}`,
          title: `Échéance proche — ${project.name}`,
          explanation: `Échéance dans ${project.daysUntilDeadline} jour(s) avec seulement ${project.progressPercent}% d'avancement (${project.doneTasks}/${project.totalTasks} tâches terminées).`,
          priority: project.daysUntilDeadline <= 7 ? "elevee" : "moyenne",
          suggestedAction: "Créer un sprint de rattrapage ou ajuster la date de fin du projet.",
          actionPath: `/projects/${project.id}`,
          actionType: "create_sprint",
          projectId: project.id,
          date: project.deadline ?? generatedAt,
        })
      );
    }

    if (project.totalTasks >= 8 && project.memberCount <= 1) {
      items.push(
        enrichRecommendation({
          id: `team-${project.id}`,
          title: `Renfort d'équipe — ${project.name}`,
          explanation: `${project.totalTasks} tâches pour ${project.memberCount} membre(s) seulement. La charge est déséquilibrée.`,
          priority: "moyenne",
          suggestedAction: "Ajouter un membre au projet via la sélection d'équipe.",
          actionPath: `/projects/${project.id}`,
          actionType: "add_member",
          projectId: project.id,
          date: generatedAt,
        })
      );
    }

    if (
      (project.inactiveDays ?? 0) >= 14 &&
      !isProjectCompleted(project.status) &&
      statusNorm !== "ON_HOLD"
    ) {
      items.push(
        enrichRecommendation({
          id: `inactive-${project.id}`,
          title: `Projet inactif — ${project.name}`,
          explanation: `Aucune activité significative depuis ${project.inactiveDays} jours (${project.openTasks} tâche(s) encore ouverte(s)).`,
          priority: "faible",
          suggestedAction: "Mettre à jour le statut du projet et relancer l'équipe.",
          actionPath: `/projects/${project.id}`,
          actionType: "update_project_status",
          projectId: project.id,
          date: generatedAt,
        })
      );
    }

    if (isProjectBlocked(project.status)) {
      items.push(
        enrichRecommendation({
          id: `blocked-${project.id}`,
          title: `Projet bloqué — ${project.name}`,
          explanation: `Le projet est en statut « ${project.status} » avec ${project.openTasks} tâche(s) en suspens.`,
          priority: "elevee",
          suggestedAction: "Changer le statut du projet et débloquer le planning.",
          actionPath: `/projects/${project.id}`,
          actionType: "update_project_status",
          projectId: project.id,
          date: generatedAt,
        })
      );
    }
  }

  const overloaded = [...snapshot.members]
    .filter((m) => m.assignedOpenTasks >= 8)
    .sort((a, b) => b.assignedOpenTasks - a.assignedOpenTasks);
  if (overloaded[0]) {
    const m = overloaded[0];
    items.push(
      enrichRecommendation({
        id: `workload-${m.id}`,
        title: `Charge élevée — ${m.name}`,
        explanation: `${m.name} a ${m.assignedOpenTasks} tâche(s) ouverte(s) dont ${m.overdueTasks} en retard, sur ${m.projectCount} projet(s).`,
        priority: m.overdueTasks >= 3 ? "elevee" : "moyenne",
        suggestedAction: "Appliquer les réassignations de tâches suggérées.",
        actionPath: "/team",
        actionType: "redistribute_workload",
        memberId: m.id,
        date: generatedAt,
      })
    );
  }

  if (snapshot.summary.overdueTasks >= 10) {
    items.push(
      enrichRecommendation({
        id: "overdue-portfolio",
        title: "Nombreuses tâches en retard",
        explanation: `${snapshot.summary.overdueTasks} tâches en retard dans le portefeuille. Une redistribution ciblée est recommandée.`,
        priority: "elevee",
        suggestedAction: "Réévaluer et réassigner les tâches en retard prioritaires.",
        actionPath: "/projects?status=DELAYED",
        actionType: "review_tasks",
        date: generatedAt,
      })
    );
  }

  for (const member of snapshot.members.filter((m) => m.assignedOpenTasks === 0)) {
    items.push(
      enrichRecommendation({
        id: `unassigned-${member.id}`,
        title: `Membre disponible — ${member.name}`,
        explanation: `${member.name} n'a aucune tâche assignée (${member.projectCount} projet(s) au profil).`,
        priority: "faible",
        suggestedAction: "Affecter ce membre à un projet prioritaire.",
        actionPath: "/team",
        actionType: "assign_member",
        memberId: member.id,
        date: generatedAt,
      })
    );
    if (items.filter((i) => i.id.startsWith("unassigned-")).length >= 3) break;
  }

  const seen = new Set<string>();
  const deduped = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return sortRecommendations(deduped).slice(0, 12);
}

function filterRecommendationsToScope(
  items: AdminRecommendationItem[],
  scope: AdminRecommendationScope,
  snapshot: PortfolioSnapshot
): AdminRecommendationItem[] {
  const scopedMemberIds = new Set(snapshot.members.map((m) => m.id));
  return items.filter(
    (item) =>
      isProjectInAdminScope(item.projectId, scope) &&
      isMemberInAdminScope(item.memberId, scopedMemberIds)
  );
}

async function generateAiRecommendations(
  snapshot: PortfolioSnapshot
): Promise<{ recommendations: AdminRecommendationItem[]; provider: "groq" | "openai" }> {
  const context = buildPortfolioContextText(snapshot);

  const system = `Tu es un assistant IA expert en gestion de projet pour administrateurs d'entreprise.
Analyse les données réelles du portefeuille PERSONNEL de l'administrateur connecté (projets qu'il gère, leurs tâches, échéances, membres assignés et charge) et produis entre 3 et 10 recommandations actionnables en français.

Règles :
- Base-toi UNIQUEMENT sur les données fournies ; n'invente pas de chiffres.
- Ne recommande jamais d'actions sur des projets ou membres absents des données (hors périmètre admin).
- Couvre si pertinent : retards, échéances proches, sous-effectif, membres sans tâches, surcharge, projets inactifs ou bloqués, faible avancement.
- priority doit être exactement : "faible", "moyenne" ou "elevee".
- actionPath : chemin relatif (/projects/{id}, /team, /projects?status=DELAYED).
- actionType : add_member | assign_member | review_tasks | redistribute_workload | update_timeline | create_sprint | update_project_status | open_portfolio
- projectId / memberId : entiers si applicable
- id : identifiant stable court slug (ex: delay-proj-12, workload-user-5).

Réponds UNIQUEMENT avec un JSON valide :
{"recommendations":[{"id":"...","title":"...","explanation":"...","priority":"faible|moyenne|elevee","suggestedAction":"...","actionPath":"...","actionType":"...","projectId":null,"memberId":null}]}`;

  const user = `${context}

Génère des recommandations intelligentes et personnalisées pour l'espace de travail de cet administrateur.`;

  let text = "";
  let provider: "groq" | "openai" = "groq";
  try {
    const llmResult = await invokeLlm(system, user);
    text = llmResult.text;
    provider = llmResult.provider;
  } catch (err) {
    console.error("[generateAiRecommendations] Groq/OpenAI call failed:", err);
    throw err;
  }

  if (!text.trim()) {
    throw new Error("Réponse IA vide.");
  }

  const parsed = parseAiRecommendations(text, snapshot.generatedAt);
  if (parsed.length === 0) {
    console.warn(
      "[generateAiRecommendations] Unparseable AI response:",
      text.slice(0, 400)
    );
    throw new Error("Impossible d'interpréter la réponse IA.");
  }
  return { recommendations: parsed, provider };
}

async function filterArchivedRecommendations(
  enterpriseId: number,
  adminUserId: number,
  items: AdminRecommendationItem[]
): Promise<AdminRecommendationItem[]> {
  try {
    const archived = await getArchivedRecommendationIds(enterpriseId, adminUserId);
    if (archived.size === 0) return items;
    return items.filter((item) => !archived.has(item.id));
  } catch (err) {
    console.error("[filterArchivedRecommendations]", err);
    return items;
  }
}

function aiFailureResult(generatedAt: string): AdminRecommendationsResult {
  return {
    success: false,
    recommendations: [],
    provider: null,
    generatedAt,
    configured: true,
    message: AI_FAIL_MESSAGE,
  };
}

export async function getAdminRecommendations(
  enterpriseId: number,
  adminUserId: number
): Promise<AdminRecommendationsResult> {
  const generatedAt = new Date().toISOString();

  try {
    const scope = await loadAdminRecommendationScope(enterpriseId, adminUserId);
    const snapshot = await loadAdminPortfolioSnapshot(enterpriseId, adminUserId);
    const configured = isTaskAssistantConfigured();

    if (configured) {
      try {
        const result = await generateAiRecommendations(snapshot);
        let recommendations = filterRecommendationsToScope(
          result.recommendations,
          scope,
          snapshot
        );
        recommendations = await filterArchivedRecommendations(
          enterpriseId,
          adminUserId,
          recommendations
        );
        return {
          success: true,
          recommendations,
          provider: result.provider,
          generatedAt: snapshot.generatedAt,
          configured: true,
        };
      } catch (err) {
        console.error("[getAdminRecommendations] AI generation failed:", err);
        return aiFailureResult(snapshot.generatedAt);
      }
    }

    if (snapshot.summary.totalProjects === 0 && snapshot.members.length === 0) {
      return {
        success: true,
        recommendations: [],
        provider: "data-driven",
        generatedAt: snapshot.generatedAt,
        configured: false,
      };
    }

    let recommendations = filterRecommendationsToScope(
      generateDataDrivenRecommendations(snapshot),
      scope,
      snapshot
    );
    recommendations = await filterArchivedRecommendations(
      enterpriseId,
      adminUserId,
      recommendations
    );

    return {
      success: true,
      recommendations,
      provider: "data-driven",
      generatedAt: snapshot.generatedAt,
      configured: false,
    };
  } catch (err) {
    console.error("[getAdminRecommendations] unexpected error:", err);
    return {
      success: false,
      recommendations: [],
      provider: null,
      generatedAt,
      configured: isTaskAssistantConfigured(),
      message: AI_FAIL_MESSAGE,
    };
  }
}

export { NOT_CONFIGURED_MSG };
