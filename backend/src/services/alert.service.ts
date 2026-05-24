import prisma from "../prisma/prismaClient";
import { isCompletedStatut } from "../lib/taskStatutWorkflow";
import { isPastDueCalendar } from "../lib/taskDueCalendar";
import {
  buildNotificationEventKey,
  createNotification,
} from "./notification.service";

const OVERDUE_DEDUP_MS = 30_000;

async function hasRecentOverdueNotice(
  userId: number,
  sujet: string,
  taskId: number
): Promise<boolean> {
  const since = new Date(Date.now() - OVERDUE_DEDUP_MS);
  const eventKey = buildNotificationEventKey(sujet, taskId, userId);
  const row = await prisma.notification.findFirst({
    where: {
      id_utilisateur: userId,
      sujet,
      date_envoi: { gte: since },
    },
    orderBy: { date_envoi: "desc" },
    select: { metadata: true },
  });
  if (!row) return false;
  try {
    const meta = row.metadata ? JSON.parse(row.metadata) : {};
    if (meta?.eventKey === eventKey) return true;
    if (Number(meta?.taskId) === taskId) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export const checkOverdueTasks = async () => {
  console.log("[notification] checkOverdueTasks started");
  const overdueTasks = await prisma.tache.findMany({
    where: {
      date_limite_t: { not: null },
      assigne_a: { not: null },
      deleted_at: null,
    },
    include: {
      utilisateur: true,
      projet: {
        include: {
          affectation: {
            where: { role_affectation: "chef" },
            include: { utilisateur: true },
          },
        },
      },
    },
  });

  let alertsCreated = 0;

  for (const task of overdueTasks) {
    if (isCompletedStatut(task.statut_t)) continue;
    if (!isPastDueCalendar(task.date_limite_t)) continue;
    if (!task.assigne_a) continue;

    const taskMeta = {
      taskId: task.id_tache,
      projectId: task.id_projet,
    };

    const assigneeId = Number(task.assigne_a);
    const assigneeSujet = "Retard sur tâche";

    if (
      !(await hasRecentOverdueNotice(assigneeId, assigneeSujet, task.id_tache))
    ) {
      const beforeAssignee = new Date();
      const assigneeNotif = await createNotification({
        id_utilisateur: assigneeId,
        sujet: assigneeSujet,
        message: `La tâche "${task.nom_t}" est en retard. Date prévue : ${task.date_limite_t?.toLocaleDateString()}`,
        type: "danger",
        taskId: task.id_tache,
        metadata: taskMeta,
      });

      if (
        assigneeNotif?.date_envoi &&
        new Date(assigneeNotif.date_envoi) >= beforeAssignee
      ) {
        alertsCreated++;
      }
    }

    const chefs = task.projet?.affectation || [];
    const notifiedChefIds = new Set<number>();
    const chefSujet = "Alerte Retard Équipe";

    for (const chef of chefs) {
      const chefId = Number(chef.id_utilisateur);
      if (!Number.isFinite(chefId) || chefId < 1) continue;
      if (notifiedChefIds.has(chefId)) continue;
      if (chefId === assigneeId) continue;
      notifiedChefIds.add(chefId);

      if (await hasRecentOverdueNotice(chefId, chefSujet, task.id_tache)) {
        continue;
      }

      await createNotification({
        id_utilisateur: chefId,
        sujet: chefSujet,
        message: `L'utilisateur ${task.utilisateur?.prenom} est en retard sur la tâche "${task.nom_t}" (Projet: ${task.projet?.nom_p})`,
        type: "warning",
        taskId: task.id_tache,
        metadata: taskMeta,
      });
    }
  }

  return alertsCreated;
};
