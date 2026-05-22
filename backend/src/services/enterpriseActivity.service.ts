import prisma from "../prisma/prismaClient";
import {
  isEnterpriseAdminScopedActivity,
  isMemberScopedActivity,
} from "../lib/activityFilters";

export type EnterpriseActivityType =
  | "project"
  | "task"
  | "user"
  | "invitation"
  | "member"
  | "access"
  | "info";

export type EnterpriseActivityStatus = "ACTIVE" | "PENDING" | "WARNING";

export type EnterpriseActivityCategory = "projects" | "tasks" | "team" | "admin";

export interface EnterpriseActivityItem {
  id: string;
  type: EnterpriseActivityType;
  category: EnterpriseActivityCategory;
  user: string;
  action: string;
  title: string;
  subtitle: string;
  entityLabel: string;
  entityType: "project" | "task" | "user" | "member" | "invitation" | null;
  entityId: number | null;
  date: string;
  status: EnterpriseActivityStatus;
}

function categorize(
  type: string,
  action: string
): EnterpriseActivityCategory {
  const a = action.toLowerCase();
  if (type === "task" || /tâche/i.test(a)) return "tasks";
  if (
    type === "user" ||
    type === "member" ||
    type === "invitation" ||
    /membre|admin invité|invitation|équipe/i.test(a)
  ) {
    return "team";
  }
  if (type === "access" || /permission/i.test(a)) return "admin";
  return "projects";
}

function entityTypeFrom(
  type: string,
  action: string
): EnterpriseActivityItem["entityType"] {
  if (type === "task" || /tâche/i.test(action)) return "task";
  if (type === "user" || type === "member" || /membre|admin/i.test(action))
    return "user";
  if (type === "invitation") return "invitation";
  if (type === "project" || /projet/i.test(action)) return "project";
  return null;
}

function taskDone(statut: string | null | undefined): boolean {
  const s = String(statut ?? "").toUpperCase();
  return s === "DONE" || s === "TERMINÉ" || s === "TERMINÉE" || s === "TERMINE";
}

function buildItem(params: {
  id: string;
  type: EnterpriseActivityType;
  user: string;
  action: string;
  title: string;
  subtitle: string;
  entityLabel: string;
  entityType: EnterpriseActivityItem["entityType"];
  entityId: number | null;
  date: Date;
  status?: EnterpriseActivityStatus;
}): EnterpriseActivityItem {
  return {
    id: params.id,
    type: params.type,
    category: categorize(params.type, params.action),
    user: params.user.trim() || "Équipe",
    action: params.action,
    title: params.title,
    subtitle: params.subtitle,
    entityLabel: params.entityLabel,
    entityType: params.entityType,
    entityId: params.entityId,
    date: params.date.toISOString(),
    status: params.status ?? "ACTIVE",
  };
}

function mapDbRow(
  act: {
    id: number;
    user: string;
    action: string;
    entreprise?: string | null;
    status: string;
    type: string;
    entityId?: number | null;
    date: Date;
  },
  projectNames: Map<number, string>
): EnterpriseActivityItem | null {
  const type = String(act.type || "info").toLowerCase() as EnterpriseActivityType;
  const action = String(act.action || "").trim();
  if (!action) return null;

  const projectId =
    act.entityId != null && Number.isFinite(Number(act.entityId))
      ? Number(act.entityId)
      : null;
  const projectName =
    (projectId != null ? projectNames.get(projectId) : undefined) ||
    (String(act.entreprise || "").startsWith("Projet:")
      ? String(act.entreprise).replace(/^Projet:\s*/i, "").trim()
      : "") ||
    "Projet";

  let entityLabel = projectName;
  let entityType = entityTypeFrom(type, action);
  let title = action;

  if (type === "task" || /tâche/i.test(action)) {
    entityLabel = projectName;
    title = action;
  } else if (type === "project" || /projet/i.test(action)) {
    entityLabel = projectName;
    title = /cré/i.test(action)
      ? `Projet « ${projectName} » créé`
      : `Projet « ${projectName} »`;
  } else if (/admin invité|invitation/i.test(action)) {
    entityLabel = String(act.entreprise || "").trim() || "Équipe";
    entityType = "invitation";
    title = action;
  } else if (/accès projet/i.test(action)) {
    entityLabel = projectName;
    entityType = "project";
    title = action;
  }

  return buildItem({
    id: `db-${act.id}`,
    type,
    user: act.user,
    action,
    title,
    subtitle: entityLabel,
    entityLabel,
    entityType,
    entityId: projectId,
    date: new Date(act.date),
    status: (act.status as EnterpriseActivityStatus) || "ACTIVE",
  });
}

/**
 * Tenant admin dashboard feed — projects, tasks & team within one enterprise.
 */
export async function getEnterpriseRecentActivities(
  enterpriseId: number,
  enterpriseName: string,
  limit = 20
): Promise<EnterpriseActivityItem[]> {
  const entName = enterpriseName.trim();
  const cap = Math.min(Math.max(limit, 1), 50);

  const projects = await prisma.projet.findMany({
    where: { id_entreprise: enterpriseId },
    select: {
      id_projet: true,
      nom_p: true,
      createdAt: true,
      date_debut: true,
    },
    orderBy: { createdAt: "desc" },
    take: cap * 3,
  });

  const projectIds = projects.map((p) => p.id_projet);
  const projectNameById = new Map(
    projects.map((p) => [p.id_projet, p.nom_p?.trim() || "Projet"])
  );

  const projectIdList = projectIds.length ? projectIds : [-1];

  const [dbActivities, tasks] = await Promise.all([
    (prisma as any).activity.findMany({
      where: {
        OR: [
          { entreprise: entName },
          { entreprise: { contains: entName } },
          {
            type: { in: ["project", "task", "access", "user", "member", "invitation", "info"] },
            entityId: { in: projectIdList },
          },
        ],
      },
      orderBy: { date: "desc" },
      take: cap * 4,
    }),
    projectIds.length
      ? prisma.tache.findMany({
          where: { id_projet: { in: projectIds } },
          select: {
            id_tache: true,
            nom_t: true,
            statut_t: true,
            id_projet: true,
            date_debut_t: true,
            date_fin_t: true,
            date_limite_t: true,
            utilisateur: {
              select: { prenom: true, nom: true },
            },
          },
          orderBy: { date_debut_t: "desc" },
          take: cap * 3,
        })
      : Promise.resolve([]),
  ]);

  const items: EnterpriseActivityItem[] = [];

  for (const act of dbActivities) {
    if (
      !isEnterpriseAdminScopedActivity(
        {
          type: act.type,
          action: act.action,
          user: act.user,
          entreprise: act.entreprise,
        },
        entName
      )
    ) {
      continue;
    }
    const mapped = mapDbRow(act, projectNameById);
    if (mapped) items.push(mapped);
  }

  for (const p of projects) {
    const name = p.nom_p?.trim() || "Projet";
    const createdAt = p.createdAt ?? p.date_debut ?? new Date();
    items.push(
      buildItem({
        id: `proj-create-${p.id_projet}`,
        type: "project",
        user: "Administration",
        action: "Projet créé",
        title: `Projet « ${name} » créé`,
        subtitle: "Nouveau projet",
        entityLabel: name,
        entityType: "project",
        entityId: p.id_projet,
        date: new Date(createdAt),
      })
    );
  }

  for (const t of tasks) {
    if (t.id_projet == null) continue;
    const projectName = projectNameById.get(t.id_projet) || "Projet";
    const taskTitle = t.nom_t?.trim() || "Tâche";
    const userName = t.utilisateur
      ? `${t.utilisateur.prenom || ""} ${t.utilisateur.nom || ""}`.trim()
      : "Membre";
    const createdAt = t.date_debut_t ?? new Date();
    const done = taskDone(t.statut_t);

    items.push(
      buildItem({
        id: `task-create-${t.id_tache}`,
        type: "task",
        user: userName || "Membre",
        action: "Nouvelle tâche créée",
        title: `Tâche « ${taskTitle} » créée`,
        subtitle: projectName,
        entityLabel: taskTitle,
        entityType: "task",
        entityId: t.id_tache,
        date: new Date(createdAt),
        status: "PENDING",
      })
    );

    if (done) {
      const doneDate = t.date_fin_t ?? t.date_limite_t ?? createdAt;
      items.push(
        buildItem({
          id: `task-done-${t.id_tache}`,
          type: "task",
          user: userName || "Membre",
          action: "Tâche terminée",
          title: `Tâche « ${taskTitle} » terminée`,
          subtitle: projectName,
          entityLabel: taskTitle,
          entityType: "task",
          entityId: t.id_tache,
          date: new Date(doneDate),
          status: "ACTIVE",
        })
      );
    }
  }

  const deduped = new Map<string, EnterpriseActivityItem>();
  for (const item of items) {
    const key = `${item.type}:${item.entityId ?? item.id}:${item.action}`;
    const prev = deduped.get(key);
    if (
      !prev ||
      new Date(item.date).getTime() > new Date(prev.date).getTime()
    ) {
      deduped.set(key, item);
    }
  }

  return [...deduped.values()]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, cap);
}

function taskOverdue(statut: string | null | undefined, dateLimite: Date | null | undefined): boolean {
  if (taskDone(statut)) return false;
  if (!dateLimite) return false;
  const due = new Date(dateLimite);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function displayUserName(
  row?: { prenom?: string | null; nom?: string | null } | null
): string {
  if (!row) return "Équipe";
  const name = `${row.prenom || ""} ${row.nom || ""}`.trim();
  return name || "Équipe";
}

/**
 * Member dashboard feed — projects the user belongs to and tasks assigned to them.
 */
export async function getMemberRecentActivities(
  userId: number,
  limit = 12
): Promise<EnterpriseActivityItem[]> {
  const cap = Math.min(Math.max(limit, 1), 30);

  const memberships = await prisma.membre_projet.findMany({
    where: { id_utilisateur: userId },
    select: {
      id_projet: true,
      createdAt: true,
      projet: { select: { id_projet: true, nom_p: true } },
    },
    orderBy: { createdAt: "desc" },
    take: cap * 2,
  });

  const assignedTasks = await prisma.tache.findMany({
    where: { assigne_a: userId },
    select: {
      id_tache: true,
      nom_t: true,
      statut_t: true,
      id_projet: true,
      date_debut_t: true,
      date_fin_t: true,
      date_limite_t: true,
      projet: { select: { nom_p: true } },
      createur: { select: { prenom: true, nom: true } },
    },
    orderBy: { date_debut_t: "desc" },
    take: cap * 4,
  });

  const projectIds = new Set<number>();
  for (const m of memberships) projectIds.add(m.id_projet);
  for (const t of assignedTasks) {
    if (t.id_projet != null) projectIds.add(t.id_projet);
  }

  const projectIdList = [...projectIds];
  const projects =
    projectIdList.length > 0
      ? await prisma.projet.findMany({
          where: { id_projet: { in: projectIdList } },
          select: { id_projet: true, nom_p: true },
        })
      : [];

  const projectNameById = new Map(
    projects.map((p) => [p.id_projet, p.nom_p?.trim() || "Projet"])
  );

  const dbActivities =
    projectIdList.length > 0
      ? await (prisma as any).activity.findMany({
          where: {
            entityId: { in: projectIdList },
            type: { in: ["project", "task", "access", "member", "info"] },
          },
          orderBy: { date: "desc" },
          take: cap * 3,
        })
      : [];

  const items: EnterpriseActivityItem[] = [];

  for (const m of memberships) {
    const name =
      m.projet?.nom_p?.trim() ||
      projectNameById.get(m.id_projet) ||
      "Projet";
    items.push(
      buildItem({
        id: `member-join-${m.id_projet}`,
        type: "access",
        user: "Équipe",
        action: "Ajouté au projet",
        title: `Vous avez rejoint « ${name} »`,
        subtitle: name,
        entityLabel: name,
        entityType: "project",
        entityId: m.id_projet,
        date: new Date(m.createdAt),
      })
    );
  }

  for (const act of dbActivities) {
    if (
      !isMemberScopedActivity({
        type: act.type,
        action: act.action,
        user: act.user,
        entreprise: act.entreprise,
      })
    ) {
      continue;
    }
    const mapped = mapDbRow(act, projectNameById);
    if (mapped) items.push(mapped);
  }

  for (const t of assignedTasks) {
    if (t.id_projet == null) continue;
    const projectName =
      t.projet?.nom_p?.trim() ||
      projectNameById.get(t.id_projet) ||
      "Projet";
    const taskTitle = t.nom_t?.trim() || "Tâche";
    const creator = displayUserName(t.createur);
    const createdAt = t.date_debut_t ?? new Date();
    const done = taskDone(t.statut_t);

    items.push(
      buildItem({
        id: `my-task-assigned-${t.id_tache}`,
        type: "task",
        user: creator,
        action: "Tâche assignée",
        title: `« ${taskTitle} » vous est assignée`,
        subtitle: projectName,
        entityLabel: taskTitle,
        entityType: "task",
        entityId: t.id_tache,
        date: new Date(createdAt),
        status: "PENDING",
      })
    );

    if (done) {
      const doneDate = t.date_fin_t ?? createdAt;
      items.push(
        buildItem({
          id: `my-task-done-${t.id_tache}`,
          type: "task",
          user: "Vous",
          action: "Tâche terminée",
          title: `Vous avez terminé « ${taskTitle} »`,
          subtitle: projectName,
          entityLabel: taskTitle,
          entityType: "task",
          entityId: t.id_tache,
          date: new Date(doneDate),
          status: "ACTIVE",
        })
      );
    } else if (taskOverdue(t.statut_t, t.date_limite_t)) {
      items.push(
        buildItem({
          id: `my-task-late-${t.id_tache}`,
          type: "task",
          user: "Vous",
          action: "Tâche en retard",
          title: `« ${taskTitle} » est en retard`,
          subtitle: projectName,
          entityLabel: taskTitle,
          entityType: "task",
          entityId: t.id_tache,
          date: new Date(t.date_limite_t ?? createdAt),
          status: "WARNING",
        })
      );
    }
  }

  const deduped = new Map<string, EnterpriseActivityItem>();
  for (const item of items) {
    const key = `${item.id}`;
    const prev = deduped.get(key);
    if (
      !prev ||
      new Date(item.date).getTime() > new Date(prev.date).getTime()
    ) {
      deduped.set(key, item);
    }
  }

  return [...deduped.values()]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, cap);
}

/** Log significant workspace events for the enterprise admin feed. */
export async function logEnterpriseAdminActivity(params: {
  enterpriseName: string;
  user: string;
  action: string;
  type?: string;
  entityId?: number | null;
  status?: EnterpriseActivityStatus;
}): Promise<void> {
  const action = String(params.action ?? "").trim();
  if (!action) return;

  const allowed =
    /projet|tâche|task|membre|accès|permission|invitation|admin/i.test(action);
  if (!allowed) return;

  try {
    await (prisma as any).activity.create({
      data: {
        user: params.user,
        action,
        entreprise: params.enterpriseName,
        status: params.status ?? "ACTIVE",
        type: params.type ?? "info",
        entityId: params.entityId ?? null,
        date: new Date(),
      },
    });
  } catch (e) {
    console.error("[logEnterpriseAdminActivity]", e);
  }
}
