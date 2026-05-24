import Groq from "groq-sdk";
import { trimEnvValue } from "../config/env";
import prisma from "../prisma/prismaClient";
import { runTaskAssistantSimulated } from "./taskAssistantSimulated";

export type TaskAssistantAction =
  | "generate_description"
  | "generate_subtasks"
  | "summarize_task"
  | "suggest_next_steps"
  | "improve_title"
  | "similar_tasks";

export const MEMBER_TASK_ASSISTANT_ACTIONS: TaskAssistantAction[] = [
  "generate_description",
  "generate_subtasks",
  "summarize_task",
  "suggest_next_steps",
];

export const TASK_ASSISTANT_ACTIONS: TaskAssistantAction[] = [
  ...MEMBER_TASK_ASSISTANT_ACTIONS,
  "improve_title",
  "similar_tasks",
];

export type TaskAssistantContext = {
  taskTitle: string;
  taskDescription?: string;
  status?: string;
  statusLabel?: string;
  assignee?: string;
  dateStart?: string | null;
  dateDue?: string | null;
  priority?: string;
  priorityLabel?: string;
};

export type TaskAssistantInput = TaskAssistantContext & {
  action: TaskAssistantAction;
};

export type TaskAssistantResult = {
  action: TaskAssistantAction;
  provider: "groq" | "openai" | "simulated";
  simulated?: boolean;
  description?: string;
  title?: string;
  subtasks?: string[];
  suggestions?: string[];
  summary?: string;
  steps?: string[];
  raw?: string;
};

export const NOT_CONFIGURED_MSG =
  "IA non configurée. Ajoutez une clé API gratuite dans .env";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const OPENAI_MODEL = trimEnvValue(process.env.OPENAI_MODEL) || "gpt-4o-mini";

function getGroqClient(): Groq | null {
  const apiKey = trimEnvValue(process.env.GROQ_API_KEY);
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

function getOpenAiKey(): string | null {
  const apiKey = trimEnvValue(process.env.OPENAI_API_KEY);
  return apiKey.length > 0 ? apiKey : null;
}

export function isTaskAssistantConfigured(): boolean {
  return getGroqClient() !== null || getOpenAiKey() !== null;
}

export function getAiProvider(): "groq" | "openai" | null {
  if (getGroqClient()) return "groq";
  if (getOpenAiKey()) return "openai";
  return null;
}

const STATUS_LABELS: Record<string, string> = {
  todo: "À faire",
  en_cours: "En cours",
  en_retard: "En retard",
  terminee: "Terminée",
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  DONE: "Terminée",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  URGENT: "Urgente",
};

export async function loadTaskAssistantContext(
  taskId: number
): Promise<TaskAssistantContext | null> {
  const task = await prisma.tache.findUnique({
    where: { id_tache: taskId },
    include: {
      utilisateur: {
        select: { nom: true, prenom: true, email: true },
      },
    },
  });
  if (!task) return null;

  const assignee = task.utilisateur
    ? `${task.utilisateur.prenom || ""} ${task.utilisateur.nom || ""}`.trim() ||
      task.utilisateur.email ||
      "Utilisateur"
    : "Non assigné";

  const statutKey = String(task.statut_t ?? "").trim();

  return {
    taskTitle: task.nom_t?.trim() || "Sans titre",
    taskDescription: task.description_t?.trim() || "",
    status: statutKey,
    statusLabel: STATUS_LABELS[statutKey] || statutKey || "—",
    assignee,
    dateStart: task.date_debut_t
      ? new Date(task.date_debut_t).toISOString()
      : null,
    dateDue: task.date_limite_t
      ? new Date(task.date_limite_t).toISOString()
      : null,
    priority: String(task.priorite_t ?? ""),
    priorityLabel:
      PRIORITY_LABELS[String(task.priorite_t ?? "").toUpperCase()] ||
      String(task.priorite_t ?? "—"),
  };
}

function buildContextText(ctx: TaskAssistantContext): string {
  const lines = [
    `Titre : "${ctx.taskTitle}"`,
    `Statut : ${ctx.statusLabel || ctx.status || "—"}`,
    `Assigné : ${ctx.assignee || "Non assigné"}`,
    `Priorité : ${ctx.priorityLabel || ctx.priority || "—"}`,
    ctx.dateStart ? `Date de début : ${ctx.dateStart.slice(0, 10)}` : null,
    ctx.dateDue ? `Date d'échéance : ${ctx.dateDue.slice(0, 10)}` : null,
    ctx.taskDescription?.trim()
      ? `Description actuelle :\n${ctx.taskDescription.trim()}`
      : "Description actuelle : (vide)",
  ].filter(Boolean);
  return lines.join("\n");
}

function buildMessages(
  input: TaskAssistantInput
): { system: string; user: string } {
  const base = buildContextText(input);

  switch (input.action) {
    case "generate_description":
      return {
        system:
          "Tu es un assistant de gestion de projet. Rédige des descriptions claires en français. Réponds uniquement avec le texte de la description, sans titre ni markdown.",
        user: `${base}\n\nRédige une description professionnelle (3 à 6 phrases).`,
      };
    case "generate_subtasks":
      return {
        system:
          'Réponds UNIQUEMENT avec un JSON : {"subtasks":["..."]}. Entre 3 et 5 sous-tâches concrètes en français.',
        user: `${base}\n\nGénère des sous-tâches actionnables.`,
      };
    case "summarize_task":
      return {
        system:
          "Tu es un assistant de gestion de projet. Résume brièvement en français (2 à 4 phrases). Réponds uniquement avec le résumé.",
        user: `${base}\n\nRésume l'état de la tâche et l'échéance.`,
      };
    case "suggest_next_steps":
      return {
        system:
          'Réponds UNIQUEMENT avec un JSON : {"steps":["..."]}. Entre 3 et 5 prochaines étapes actionnables en français.',
        user: `${base}\n\nPropose les prochaines étapes concrètes.`,
      };
    case "improve_title":
      return {
        system:
          'Réponds UNIQUEMENT avec un JSON : {"title":"..."}. Titre court et professionnel en français.',
        user: `${base}\n\nAméliore le titre.`,
      };
    case "similar_tasks":
      return {
        system:
          'Réponds UNIQUEMENT avec un JSON : {"suggestions":["..."]}. Entre 3 et 5 tâches similaires en français.',
        user: `${base}\n\nPropose des tâches similaires ou complémentaires.`,
      };
    default:
      return { system: "", user: base };
  }
}

async function callGroq(system: string, user: string): Promise<string> {
  const groq = getGroqClient();
  if (!groq) throw new Error("Groq non configuré");

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.5,
    max_tokens: 1024,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() || "";
}

async function callOpenAI(system: string, user: string): Promise<string> {
  const apiKey = getOpenAiKey();
  if (!apiKey) throw new Error("OpenAI non configuré");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.5,
      max_tokens: 1024,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI : ${res.status} ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function callLlm(system: string, user: string): Promise<{
  text: string;
  provider: "groq" | "openai";
}> {
  if (getGroqClient()) {
    return { text: await callGroq(system, user), provider: "groq" };
  }
  if (getOpenAiKey()) {
    return { text: await callOpenAI(system, user), provider: "openai" };
  }
  throw new Error(NOT_CONFIGURED_MSG);
}

/** Shared LLM entry point for admin features (recommendations, etc.). */
export async function invokeLlm(
  system: string,
  user: string
): Promise<{ text: string; provider: "groq" | "openai" }> {
  return callLlm(system, user);
}

function extractJsonBlock(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const brace = raw.match(/\{[\s\S]*\}/);
  if (brace?.[0]) return brace[0];
  return raw.trim();
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => String(x).trim())
    .filter((s) => s.length > 0)
    .slice(0, 12);
}

function parseActionResult(
  action: TaskAssistantAction,
  raw: string,
  provider: "groq" | "openai"
): TaskAssistantResult {
  const base: TaskAssistantResult = { action, provider, raw };

  if (action === "generate_description" || action === "summarize_task") {
    if (action === "generate_description") {
      return { ...base, description: raw.trim() };
    }
    return { ...base, summary: raw.trim() };
  }

  try {
    const parsed = JSON.parse(extractJsonBlock(raw)) as Record<string, unknown>;
    if (action === "improve_title") {
      const title = String(parsed.title ?? parsed.titre ?? "").trim();
      return { ...base, title: title || raw.trim() };
    }
    if (action === "generate_subtasks") {
      return {
        ...base,
        subtasks: parseStringArray(
          parsed.subtasks ?? parsed.sous_taches ?? parsed.items
        ),
      };
    }
    if (action === "similar_tasks") {
      return {
        ...base,
        suggestions: parseStringArray(
          parsed.suggestions ?? parsed.tasks ?? parsed.similar
        ),
      };
    }
    if (action === "suggest_next_steps") {
      return {
        ...base,
        steps: parseStringArray(parsed.steps ?? parsed.etapes ?? parsed.items),
      };
    }
  } catch {
    /* fallback */
  }

  const lines = raw
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.)]+\s*/, "").trim())
    .filter(Boolean);

  if (action === "improve_title") {
    return { ...base, title: lines[0] || raw.trim() };
  }
  if (action === "generate_subtasks") {
    return { ...base, subtasks: lines.slice(0, 8) };
  }
  if (action === "similar_tasks") {
    return { ...base, suggestions: lines.slice(0, 5) };
  }
  if (action === "suggest_next_steps") {
    return { ...base, steps: lines.slice(0, 8) };
  }

  return base;
}

export async function runTaskAssistant(
  input: TaskAssistantInput
): Promise<TaskAssistantResult> {
  if (!isTaskAssistantConfigured()) {
    return runTaskAssistantSimulated(input, input.action);
  }

  const { system, user } = buildMessages(input);
  const { text, provider } = await callLlm(system, user);

  if (!text) {
    throw new Error("Réponse IA vide. Réessayez.");
  }

  return parseActionResult(input.action, text, provider);
}
