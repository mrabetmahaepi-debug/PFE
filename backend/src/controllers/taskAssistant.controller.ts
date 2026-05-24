import { Response } from "express";
import prisma from "../prisma/prismaClient";
import {
  assertCanViewTasks,
  getProjectPermissionContext,
} from "../services/projectPermission.service";
import {
  isTaskAssistantConfigured,
  loadTaskAssistantContext,
  MEMBER_TASK_ASSISTANT_ACTIONS,
  runTaskAssistant,
  TASK_ASSISTANT_ACTIONS,
  type TaskAssistantAction,
  type TaskAssistantContext,
  type TaskAssistantInput,
} from "../services/taskAssistant.service";

const ACTION_LABELS: Record<TaskAssistantAction, string> = {
  generate_description: "Générer une description",
  generate_subtasks: "Générer des sous-tâches",
  summarize_task: "Résumer la tâche",
  suggest_next_steps: "Proposer les prochaines étapes",
  improve_title: "Améliorer le titre",
  similar_tasks: "Tâches similaires",
};

async function assertUserCanAccessTask(
  user: { id: number },
  taskId: number
): Promise<number> {
  const task = await prisma.tache.findUnique({
    where: { id_tache: taskId },
    select: { id_projet: true },
  });
  if (!task?.id_projet) {
    throw Object.assign(new Error("Tâche inexistante"), { status: 404 });
  }
  const ctx = await getProjectPermissionContext(user, Number(task.id_projet));
  assertCanViewTasks(ctx);
  return Number(task.id_projet);
}

function bodyToContext(req: {
  body?: Record<string, unknown>;
}): TaskAssistantContext {
  return {
    taskTitle: String(req.body?.taskTitle ?? "").trim() || "Sans titre",
    taskDescription: String(req.body?.taskDescription ?? "").trim(),
    status: String(req.body?.status ?? "").trim() || undefined,
    statusLabel: String(req.body?.statusLabel ?? "").trim() || undefined,
    assignee: String(req.body?.assignee ?? "").trim() || undefined,
    dateStart: (req.body?.dateStart as string) ?? null,
    dateDue: (req.body?.dateDue as string) ?? null,
    priority: String(req.body?.priority ?? "").trim() || undefined,
    priorityLabel: String(req.body?.priorityLabel ?? "").trim() || undefined,
  };
}

export const getTaskAssistantStatusController = async (
  _req: unknown,
  res: Response
) => {
  const configured = isTaskAssistantConfigured();
  return res.status(200).json({
    configured,
    mode: configured ? "live" : "simulated",
    actions: MEMBER_TASK_ASSISTANT_ACTIONS.map((action) => ({
      action,
      label: ACTION_LABELS[action],
    })),
  });
};

export const postTaskAssistantController = async (req: any, res: Response) => {
  try {
    const action = String(req.body?.action ?? "").trim() as TaskAssistantAction;
    if (!TASK_ASSISTANT_ACTIONS.includes(action)) {
      return res.status(400).json({
        message: "Action invalide.",
        allowedActions: TASK_ASSISTANT_ACTIONS,
      });
    }

    const user = req.user as { id: number };
    const taskId = Number(req.body?.taskId);
    let input: TaskAssistantInput;

    if (Number.isFinite(taskId) && taskId > 0) {
      await assertUserCanAccessTask(user, taskId);
      const ctx = await loadTaskAssistantContext(taskId);
      if (!ctx) {
        return res.status(404).json({ message: "Tâche inexistante" });
      }
      input = { ...ctx, action };
    } else {
      const ctx = bodyToContext(req);
      if (!ctx.taskTitle || ctx.taskTitle === "Sans titre") {
        return res.status(400).json({ message: "taskId ou taskTitle requis." });
      }
      input = { ...ctx, action };
    }

    const result = await runTaskAssistant(input);
    const configured = isTaskAssistantConfigured();

    return res.status(200).json({
      configured,
      simulated: result.simulated ?? !configured,
      ...result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erreur assistant IA";
    const status =
      (error as { status?: number })?.status === 404
        ? 404
        : (error as { status?: number })?.status === 403
          ? 403
          : 502;
    return res.status(status).json({
      message,
      code: "AI_PROVIDER_ERROR",
      configured: isTaskAssistantConfigured(),
    });
  }
};
