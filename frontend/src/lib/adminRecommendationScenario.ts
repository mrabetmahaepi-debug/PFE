import {
  actionTypeLabel,
  type AdminApplyContext,
  type AdminApplyReassignment,
} from './adminRecommendationApply';
import type {
  AdminAppliedRecommendation,
  AdminRecommendation,
  AdminRecommendationActionType,
} from './adminRecommendations';
import { recommendationExplanation } from './adminRecommendations';
import { formatActivityTimestamp } from './formatActivityTimestamp';

export type AdminAppliedScenario = {
  before: string[];
  explanation: string;
  suggestedAction: string;
  actionLabel: string;
  actionDetails: string[];
  modifications: string[];
  results: string[];
  resultSummary: string;
  appliedAt: string;
};

function uniqueItems(items: string[]): string[] {
  return [...new Set(items.filter((item) => item.trim().length > 0))];
}

function overloadedMembers(context: AdminApplyContext | null | undefined): string[] {
  if (!context) return [];
  return context.teamCandidates
    .filter((m) => m.openTasks >= 6)
    .slice(0, 4)
    .map((m) => `${m.name} — ${m.openTasks} tâche(s) ouverte(s)`);
}

function buildBeforeState(
  recommendation: AdminRecommendation,
  context: AdminApplyContext | null | undefined
): string[] {
  const items: string[] = [];

  if (context?.overdueTasks?.length) {
    items.push(
      `${context.overdueTasks.length} tâche(s) en retard${
        context.project?.name ? ` sur « ${context.project.name} »` : ''
      }`
    );
  }

  const overloaded = overloadedMembers(context);
  if (overloaded.length > 0) {
    items.push(`Membre(s) surchargé(s) : ${overloaded.join(', ')}`);
  } else if (context?.member) {
    const memberLoad = context.teamCandidates.find((m) => m.id === context.member?.id);
    if (memberLoad && memberLoad.openTasks >= 4) {
      items.push(
        `${context.member.name} — charge élevée (${memberLoad.openTasks} tâches ouvertes)`
      );
    }
  }

  if (context?.project) {
    const status = String(context.project.status ?? '').toUpperCase();
    if (status.includes('DELAY') || status.includes('RETARD')) {
      items.push(`Projet « ${context.project.name} » identifié à risque (retard)`);
    } else if (recommendation.priority === 'elevee') {
      items.push(`Projet « ${context.project.name} » sous surveillance (priorité élevée)`);
    }
  }

  if (context?.suggestedReassignments?.length) {
    const fromNames = uniqueItems(
      context.suggestedReassignments.map((r) => r.fromMemberName)
    );
    if (fromNames.length && !items.some((i) => i.includes('surchargé'))) {
      items.push(`Déséquilibre de charge — ${fromNames.join(', ')}`);
    }
  }

  const explanation = recommendationExplanation(recommendation);
  if (items.length === 0 && explanation) {
    const parts = explanation
      .split(/[.;]\s+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 12)
      .slice(0, 3);
    items.push(...parts);
  }

  if (items.length === 0) {
    items.push('Situation nécessitant une intervention administrative');
  }

  return uniqueItems(items);
}

function buildActionDetails(
  recommendation: AdminRecommendation,
  context: AdminApplyContext | null | undefined
): string[] {
  const label = actionTypeLabel(recommendation.actionType);
  const items = [label];

  if (recommendation.suggestedAction?.trim()) {
    items.push(recommendation.suggestedAction.trim());
  }

  if (context?.project?.name) {
    items.push(`Projet cible : ${context.project.name}`);
  }

  if (context?.member?.name) {
    items.push(`Membre concerné : ${context.member.name}`);
  }

  return uniqueItems(items);
}

function formatReassignment(r: AdminApplyReassignment): string {
  return `« ${r.taskName} » : ${r.fromMemberName} → ${r.toMemberName}`;
}

function buildModifications(
  recommendation: AdminRecommendation,
  context: AdminApplyContext | null | undefined,
  metadata?: Record<string, unknown>
): string[] {
  const items: string[] = [];
  const reassignments = metadata?.reassignments as AdminApplyReassignment[] | undefined;

  if (Array.isArray(reassignments) && reassignments.length > 0) {
    items.push(...reassignments.map(formatReassignment));
  }

  const memberIds = metadata?.memberIds as number[] | undefined;
  if (Array.isArray(memberIds) && memberIds.length > 0) {
    const names = memberIds
      .map((id) => context?.teamCandidates.find((m) => m.id === id)?.name ?? `Membre #${id}`)
      .join(', ');
    items.push(`${memberIds.length} membre(s) ajouté(s) au projet : ${names}`);
  }

  if (metadata?.sprintName && typeof metadata.sprintName === 'string') {
    items.push(`Sprint créé : « ${metadata.sprintName} »`);
  }

  if (metadata?.dateFin && typeof metadata.dateFin === 'string') {
    items.push(`Échéance projet ajustée au ${metadata.dateFin}`);
  }

  if (metadata?.status && typeof metadata.status === 'string') {
    items.push(`Statut projet mis à jour : ${metadata.status}`);
  }

  if (items.length === 0) {
    switch (recommendation.actionType) {
      case 'assign_member':
        items.push('Membre(s) affecté(s) au projet');
        break;
      case 'review_tasks':
        items.push('Tâches réassignées aux membres disponibles');
        break;
      case 'redistribute_workload':
        items.push('Charge redistribuée entre les membres de l\'équipe');
        break;
      case 'add_member':
        items.push('Équipe du projet mise à jour');
        break;
      case 'create_sprint':
        items.push('Nouveau sprint planifié');
        break;
      case 'update_timeline':
        items.push('Planning du projet ajusté');
        break;
      case 'update_project_status':
        items.push('Statut du projet modifié');
        break;
      default:
        items.push('Action administrative exécutée');
    }
  }

  return uniqueItems(items);
}

function buildResultItems(
  summary: string,
  actionType: AdminRecommendationActionType,
  metadata?: Record<string, unknown>
): string[] {
  const items: string[] = [];
  if (summary.trim()) items.push(summary.trim());

  const reassignments = metadata?.reassignments as AdminApplyReassignment[] | undefined;
  if (Array.isArray(reassignments) && reassignments.length > 0) {
    items.push(`${reassignments.length} tâche(s) réassignée(s)`);
    items.push('Charge de travail rééquilibrée');
  }

  switch (actionType) {
    case 'review_tasks':
      if (!items.some((i) => i.includes('réassignée'))) {
        items.push('Tâches en retard réassignées');
      }
      items.push('Risque de retard atténué');
      break;
    case 'redistribute_workload':
      if (!items.some((i) => i.includes('rééquilibrée'))) {
        items.push('Charge redistribuée entre les membres');
      }
      items.push('Surcharge réduite');
      break;
    case 'assign_member':
    case 'add_member':
      items.push('Capacité d\'équipe renforcée');
      items.push('Couverture projet améliorée');
      break;
    case 'create_sprint':
      items.push('Cadence de livraison structurée');
      break;
    case 'update_timeline':
      items.push('Échéances projet alignées');
      break;
    case 'update_project_status':
      items.push('Statut projet actualisé');
      break;
    default:
      break;
  }

  return uniqueItems(items);
}

export function buildApplyScenario(
  recommendation: AdminRecommendation,
  context: AdminApplyContext | null | undefined,
  summary: string,
  metadata?: Record<string, unknown>,
  appliedAt = new Date().toISOString()
): AdminAppliedScenario {
  return {
    before: buildBeforeState(recommendation, context),
    explanation: recommendationExplanation(recommendation),
    suggestedAction: recommendation.suggestedAction ?? '',
    actionLabel: actionTypeLabel(recommendation.actionType),
    actionDetails: buildActionDetails(recommendation, context),
    modifications: buildModifications(recommendation, context, metadata),
    results: buildResultItems(summary, recommendation.actionType, metadata),
    resultSummary: summary,
    appliedAt,
  };
}

export function parseStoredScenario(
  item: Pick<
    AdminAppliedRecommendation,
  'id' | 'title' | 'resultSummary' | 'actionType' | 'appliedAt' | 'scenario'
  >,
  metadata?: Record<string, unknown> | null
): AdminAppliedScenario {
  const rawScenario = item.scenario ?? metadata?.scenario;
  if (rawScenario && typeof rawScenario === 'object' && !Array.isArray(rawScenario)) {
    const s = rawScenario as Partial<AdminAppliedScenario>;
    return {
      before: Array.isArray(s.before) ? s.before : [],
      explanation: String(s.explanation ?? ''),
      suggestedAction: String(s.suggestedAction ?? ''),
      actionLabel: String(s.actionLabel ?? actionTypeLabel(
        (item.actionType as AdminRecommendationActionType) ?? 'open_portfolio'
      )),
      actionDetails: Array.isArray(s.actionDetails) ? s.actionDetails : [],
      modifications: Array.isArray(s.modifications) ? s.modifications : [],
      results: Array.isArray(s.results) ? s.results : [],
      resultSummary: String(s.resultSummary ?? item.resultSummary ?? ''),
      appliedAt: String(s.appliedAt ?? item.appliedAt),
    };
  }

  const actionType =
    (item.actionType as AdminRecommendationActionType) ?? 'open_portfolio';
  const stubRecommendation: AdminRecommendation = {
    id: item.id,
    title: item.title,
    explanation: String(metadata?.explanation ?? item.title),
    priority: 'faible',
    suggestedAction: String(metadata?.suggestedAction ?? ''),
    actionPath: '/projects',
    actionType,
    date: item.appliedAt,
  };

  return buildApplyScenario(
    stubRecommendation,
    null,
    item.resultSummary ?? 'Recommandation appliquée',
    metadata ?? undefined,
    item.appliedAt
  );
}

export function formatAppliedScenarioDate(isoDate: string): string {
  return formatActivityTimestamp(isoDate);
}
