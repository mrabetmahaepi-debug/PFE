import type { AdminRecommendation } from '../lib/adminRecommendations';

export type AdminRecommendationActionType =
  | 'add_member'
  | 'assign_member'
  | 'review_tasks'
  | 'redistribute_workload'
  | 'update_timeline'
  | 'create_sprint'
  | 'update_project_status'
  | 'open_portfolio';

export type AdminApplyTaskRow = {
  id: number;
  name: string;
  projectId: number;
  projectName: string;
  assigneeId: number | null;
  assigneeName: string | null;
  dueDate: string | null;
};

export type AdminApplyMemberRow = {
  id: number;
  name: string;
  email: string;
  openTasks: number;
};

export type AdminApplyReassignment = {
  taskId: number;
  taskName: string;
  fromMemberId: number;
  fromMemberName: string;
  toMemberId: number;
  toMemberName: string;
};

export type AdminApplyProjectOption = {
  id: number;
  name: string;
  openTasks: number;
  memberCount: number;
};

export type AdminApplyContext = {
  actionType: AdminRecommendationActionType;
  projectId?: number | null;
  memberId?: number | null;
  project?: {
    id: number;
    name: string;
    status: string | null;
    dateDebut: string | null;
    dateFin: string | null;
    chefId: number | null;
    teamMemberIds: number[];
  };
  member?: { id: number; name: string };
  overdueTasks: AdminApplyTaskRow[];
  teamCandidates: AdminApplyMemberRow[];
  suggestedReassignments: AdminApplyReassignment[];
  suggestedProjects: AdminApplyProjectOption[];
  suggestedSprint?: {
    name: string;
    dateDebut: string;
    dateFin: string;
    idProjet: number;
  };
  suggestedStatus?: string;
};

export function isReassignmentStyleAction(
  actionType: AdminRecommendationActionType
): boolean {
  return (
    actionType === 'redistribute_workload' ||
    actionType === 'review_tasks' ||
    actionType === 'assign_member'
  );
}

/** True when the apply modal can run an automatic redistribution or reassignment. */
export function hasAutoApplySuggestions(context: AdminApplyContext): boolean {
  switch (context.actionType) {
    case 'redistribute_workload':
      return context.suggestedReassignments.length > 0;
    case 'review_tasks':
      return context.overdueTasks.length > 0 && context.teamCandidates.length > 0;
    case 'assign_member': {
      if (context.suggestedProjects.length === 0 && !context.projectId) return false;
      const onTeam = new Set(context.project?.teamMemberIds ?? []);
      const available = context.teamCandidates.filter((m) => !onTeam.has(m.id));
      const hasRecommendedMember =
        Boolean(context.member) && !onTeam.has(context.member!.id);
      return available.length > 0 || hasRecommendedMember;
    }
    default:
      return true;
  }
}

export function resolveApplyProjectPath(
  recommendation: AdminRecommendation | null | undefined,
  context: AdminApplyContext | null | undefined
): string {
  const projectId = context?.projectId ?? context?.project?.id ?? recommendation?.projectId;
  if (projectId) return `/projects/${projectId}`;
  const actionPath = recommendation?.actionPath?.split('?')[0] ?? '';
  if (actionPath.startsWith('/projects/')) return actionPath;
  return '/projects';
}

export function actionTypeLabel(actionType: AdminRecommendationActionType): string {
  switch (actionType) {
    case 'add_member':
      return 'Ajouter un membre';
    case 'assign_member':
      return 'Affecter un membre';
    case 'review_tasks':
      return 'Réévaluer les tâches';
    case 'redistribute_workload':
      return 'Redistribuer la charge';
    case 'update_timeline':
      return 'Ajuster le planning';
    case 'create_sprint':
      return 'Créer un sprint';
    case 'update_project_status':
      return 'Mettre à jour le statut';
    default:
      return 'Action recommandée';
  }
}
