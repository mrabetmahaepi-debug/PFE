import type { AdminAppliedScenario } from './adminRecommendationScenario';

export type AdminRecommendationPriority = 'faible' | 'moyenne' | 'elevee';

export type AdminRecommendationActionType =
  | 'add_member'
  | 'assign_member'
  | 'review_tasks'
  | 'redistribute_workload'
  | 'update_timeline'
  | 'create_sprint'
  | 'update_project_status'
  | 'open_portfolio';

export type AdminRecommendation = {
  id: string;
  title: string;
  explanation: string;
  description?: string;
  priority: AdminRecommendationPriority;
  suggestedAction: string;
  actionPath: string;
  actionType: AdminRecommendationActionType;
  projectId?: number | null;
  memberId?: number | null;
  date: string;
};

export type AdminAppliedRecommendation = {
  id: string;
  title: string;
  resultSummary?: string | null;
  actionType?: string | null;
  appliedAt: string;
  status: 'applied';
  provider?: 'groq' | 'openai' | 'data-driven' | null;
  scenario?: AdminAppliedScenario | null;
};

export type AdminRecommendationTab = 'active' | 'applied';

export function filterVisibleRecommendations(
  items: AdminRecommendation[],
  hiddenIds: Set<string>
): AdminRecommendation[] {
  return items.filter((item) => !hiddenIds.has(item.id));
}

export function priorityLabel(priority: AdminRecommendationPriority): string {
  switch (priority) {
    case 'elevee':
      return 'Élevée';
    case 'moyenne':
      return 'Moyenne';
    default:
      return 'Faible';
  }
}

export function recommendationExplanation(rec: AdminRecommendation): string {
  return rec.explanation || rec.description || '';
}

export function providerBadgeLabel(
  provider: 'groq' | 'openai' | 'data-driven' | null,
  configured = true
): string {
  if (provider === 'openai') return 'IA / OpenAI';
  if (provider === 'groq') return 'IA / Groq';
  if (provider === 'data-driven') return 'IA / Données';
  if (configured) return 'IA / Groq';
  return 'IA / Données';
}

export function providerLabel(
  provider: 'groq' | 'openai' | 'data-driven' | null,
  configured: boolean
): string {
  if (provider === 'openai') return 'Généré par OpenAI';
  if (provider === 'groq') return 'Généré par Groq';
  if (provider === 'data-driven') return 'Analyse basée sur vos données';
  if (configured) return 'Analyse basée sur vos données';
  return 'Analyse basée sur vos données (IA non configurée)';
}
