import Groq from "groq-sdk";
import { trimEnvValue } from "../config/env";

export type TaskAssistantAction =
  | "generate_description"
  | "generate_subtasks"
  | "improve_title"
  | "similar_tasks";

export const TASK_ASSISTANT_ACTIONS: TaskAssistantAction[] = [
  "generate_description",
  "generate_subtasks",
  "improve_title",
  "similar_tasks",
];

export type TaskAssistantInput = {
  taskTitle: string;
  taskDescription?: string;
  action: TaskAssistantAction;
};

export type TaskAssistantResult = {
  action: TaskAssistantAction;
  provider: "groq";
  description?: string;
  title?: string;
  subtasks?: string[];
  suggestions?: string[];
  raw?: string;
};

const NOT_CONFIGURED_MSG =
  "IA non configurée. Ajoutez une clé API gratuite dans .env";

const GROQ_MODEL = "llama-3.3-70b-versatile";

function getGroqClient(): Groq | null {
  const apiKey = trimEnvValue(process.env.GROQ_API_KEY);
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

export function isTaskAssistantConfigured(): boolean {
  return getGroqClient() !== null;
}

export function getAiProvider(): "groq" | null {
  return isTaskAssistantConfigured() ? "groq" : null;
}

function buildMessages(
  input: TaskAssistantInput
): { system: string; user: string } {
  const title = input.taskTitle.trim() || "Sans titre";
  const desc = (input.taskDescription || "").trim();

  const base = `Titre de la tâche : "${title}"${
    desc ? `\nDescription actuelle :\n${desc}` : ""
  }`;

  switch (input.action) {
    case "generate_description":
      return {
        system:
          "Tu es un assistant de gestion de projet. Rédige des descriptions de tâches claires et actionnables en français. Réponds uniquement avec le texte de la description, sans titre ni markdown.",
        user: `${base}\n\nRédige une description professionnelle (3 à 6 phrases) pour cette tâche.`,
      };
    case "generate_subtasks":
      return {
        system:
          'Tu es un assistant de gestion de projet. Réponds UNIQUEMENT avec un JSON valide : {"subtasks":["..."]}. Entre 3 et 8 sous-tâches concrètes en français, courtes.',
        user: `${base}\n\nGénère des sous-tâches pour cette tâche. Décompose-la en étapes actionnables.`,
      };
    case "improve_title":
      return {
        system:
          'Tu es un assistant de gestion de projet. Réponds UNIQUEMENT avec un JSON valide : {"title":"..."}. Un titre court, clair et professionnel en français.',
        user: `${base}\n\nAméliore le titre de cette tâche.`,
      };
    case "similar_tasks":
      return {
        system:
          'Tu es un assistant de gestion de projet. Réponds UNIQUEMENT avec un JSON valide : {"suggestions":["..."]}. Entre 3 et 5 idées de tâches similaires ou liées en français.',
        user: `${base}\n\nPropose des tâches similaires ou complémentaires.`,
      };
    default:
      return { system: "", user: base };
  }
}

async function callGroq(system: string, user: string): Promise<string> {
  const groq = getGroqClient();
  if (!groq) throw new Error(NOT_CONFIGURED_MSG);

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
  raw: string
): TaskAssistantResult {
  const base: TaskAssistantResult = { action, provider: "groq", raw };

  if (action === "generate_description") {
    return { ...base, description: raw.trim() };
  }

  try {
    const parsed = JSON.parse(extractJsonBlock(raw)) as Record<string, unknown>;
    if (action === "improve_title") {
      const title = String(parsed.title ?? parsed.titre ?? "").trim();
      return { ...base, title: title || raw.trim() };
    }
    if (action === "generate_subtasks") {
      const subtasks = parseStringArray(
        parsed.subtasks ?? parsed.sous_taches ?? parsed.items
      );
      return { ...base, subtasks };
    }
    if (action === "similar_tasks") {
      const suggestions = parseStringArray(
        parsed.suggestions ?? parsed.tasks ?? parsed.similar
      );
      return { ...base, suggestions };
    }
  } catch {
    /* fallback below */
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

  return base;
}

export async function runTaskAssistant(
  input: TaskAssistantInput
): Promise<TaskAssistantResult> {
  if (!isTaskAssistantConfigured()) {
    throw new Error(NOT_CONFIGURED_MSG);
  }

  const { system, user } = buildMessages(input);
  const text = await callGroq(system, user);

  if (!text) {
    throw new Error("Réponse IA vide. Réessayez.");
  }

  return parseActionResult(input.action, text);
}

export { NOT_CONFIGURED_MSG };
