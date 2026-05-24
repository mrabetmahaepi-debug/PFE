import type {
  TaskAssistantAction,
  TaskAssistantContext,
  TaskAssistantResult,
} from "./taskAssistant.service";

function formatDateFr(raw?: string | null): string {
  if (!raw) return "non définie";
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(raw);
  }
}

function contextBlock(ctx: TaskAssistantContext): string {
  return [
    `Titre : ${ctx.taskTitle}`,
    `Statut : ${ctx.statusLabel || ctx.status || "—"}`,
    `Assigné : ${ctx.assignee || "Non assigné"}`,
    `Priorité : ${ctx.priorityLabel || ctx.priority || "—"}`,
    `Début : ${formatDateFr(ctx.dateStart)}`,
    `Échéance : ${formatDateFr(ctx.dateDue)}`,
    ctx.taskDescription?.trim()
      ? `Description :\n${ctx.taskDescription.trim()}`
      : "Description : (vide)",
  ].join("\n");
}

export function runTaskAssistantSimulated(
  ctx: TaskAssistantContext,
  action: TaskAssistantAction
): TaskAssistantResult {
  const title = ctx.taskTitle.trim() || "cette tâche";
  const due = formatDateFr(ctx.dateDue);
  const status = ctx.statusLabel || ctx.status || "en cours";

  switch (action) {
    case "generate_description":
      return {
        action,
        provider: "simulated" as const,
        simulated: true,
        description: [
          `Objectif : réaliser « ${title} » dans les délais convenus.`,
          "",
          `Contexte : la tâche est actuellement ${status.toLowerCase()}. ${
            ctx.assignee && ctx.assignee !== "Non assigné"
              ? `${ctx.assignee} en est responsable.`
              : "Pensez à assigner un responsable."
          }`,
          "",
          `Livrables attendus : définir les critères de succès, documenter les décisions et valider le résultat avant l'échéance du ${due}.`,
          "",
          ctx.taskDescription?.trim()
            ? `Note : s'appuyer sur les éléments déjà mentionnés dans la description existante.`
            : `Prochaine étape : préciser le périmètre et les dépendances avec l'équipe.`,
        ].join("\n"),
      };

    case "generate_subtasks": {
      const subtasks = [
        `Clarifier le périmètre de « ${title} »`,
        "Identifier les ressources et dépendances",
        "Planifier les jalons intermédiaires",
        `Préparer la livraison avant le ${due}`,
        "Faire la revue et la clôture de la tâche",
      ].slice(0, 5);
      return {
        action,
        provider: "simulated" as const,
        simulated: true,
        subtasks,
      };
    }

    case "summarize_task":
      return {
        action,
        provider: "simulated" as const,
        simulated: true,
        summary: [
          `« ${title} » est ${status.toLowerCase()}.`,
          ctx.assignee && ctx.assignee !== "Non assigné"
            ? `Assignée à ${ctx.assignee}.`
            : "Aucun assigné pour le moment.",
          `Échéance : ${due}.`,
          ctx.taskDescription?.trim()
            ? "Une description est déjà renseignée."
            : "La description est encore vide — à compléter.",
        ].join(" "),
      };

    case "suggest_next_steps": {
      const steps = [
        status.toLowerCase().includes("term")
          ? "Archiver les livrables et partager le retour d'expérience"
          : "Confirmer l'objectif et les critères de fin avec les parties prenantes",
        "Mettre à jour le statut si le travail a démarré",
        ctx.dateDue
          ? `Vérifier l'avancement par rapport à l'échéance du ${due}`
          : "Fixer une date d'échéance réaliste",
        "Lister les blocages éventuels et les escalader si besoin",
        "Documenter les décisions dans la description de la tâche",
      ];
      return {
        action,
        provider: "simulated" as const,
        simulated: true,
        steps,
      };
    }

    default:
      return {
        action,
        provider: "simulated" as const,
        simulated: true,
        summary: contextBlock(ctx),
      };
  }
}
