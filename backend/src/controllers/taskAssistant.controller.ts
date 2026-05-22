import { Response } from "express";
import {
  isTaskAssistantConfigured,
  NOT_CONFIGURED_MSG,
  runTaskAssistant,
  TASK_ASSISTANT_ACTIONS,
  type TaskAssistantAction,
} from "../services/taskAssistant.service";

const ACTION_LABELS: Record<TaskAssistantAction, string> = {
  generate_description: "Générer la description",
  generate_subtasks: "Générer des sous-tâches",
  improve_title: "Améliorer le titre",
  similar_tasks: "Tâches similaires",
};

export const getTaskAssistantStatusController = async (
  _req: unknown,
  res: Response
) => {
  return res.status(200).json({
    configured: isTaskAssistantConfigured(),
    actions: TASK_ASSISTANT_ACTIONS.map((action) => ({
      action,
      label: ACTION_LABELS[action],
    })),
  });
};

export const postTaskAssistantController = async (req: any, res: Response) => {
  try {
    if (!isTaskAssistantConfigured()) {
      return res.status(503).json({
        message: NOT_CONFIGURED_MSG,
        code: "AI_NOT_CONFIGURED",
        configured: false,
      });
    }

    const taskTitle = String(req.body?.taskTitle ?? "").trim();
    const taskDescription = String(req.body?.taskDescription ?? "").trim();
    const action = String(req.body?.action ?? "").trim() as TaskAssistantAction;

    if (!taskTitle && action !== "improve_title") {
      return res.status(400).json({
        message: "Le titre de la tâche est requis.",
      });
    }

    if (!TASK_ASSISTANT_ACTIONS.includes(action)) {
      return res.status(400).json({
        message: "Action invalide.",
        allowedActions: TASK_ASSISTANT_ACTIONS,
      });
    }

    const result = await runTaskAssistant({
      taskTitle: taskTitle || "Sans titre",
      taskDescription,
      action,
    });

    return res.status(200).json({
      configured: true,
      ...result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erreur assistant IA";
    const isConfig = message === NOT_CONFIGURED_MSG;
    return res.status(isConfig ? 503 : 502).json({
      message,
      code: isConfig ? "AI_NOT_CONFIGURED" : "AI_PROVIDER_ERROR",
      configured: isTaskAssistantConfigured(),
    });
  }
};
