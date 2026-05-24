import type { NavigateFunction } from 'react-router-dom';
import type { SpaceTreeNode } from '../types/hierarchy';
import type { Projet } from '../types/project';
import { appPaths } from './workspaceRoutes';
import { findMonEspaceSpaceId, monEspacePathFromSpaces } from './monEspaceRoute';
import { spaceService } from '../services/space.service';
import type { KanbanWorkflowColumnId } from './kanbanWorkflowColumns';
import {
  EMPTY_MEMBER_ASSIGNED_FILTERS,
  type MemberAssignedListFilters,
  type MemberDueDateFilter,
} from './memberAssignedFilters';
import type { TodayWorkGroupKey } from './memberTasksViews';

export const MEMBER_DASHBOARD_PROJECT_NAME = 'Gestion de projet';

export const MEMBER_DASHBOARD_ROUTES = {
  assigned: '/tasks?view=assigned',
  assignedOverdue: '/tasks?view=assigned&due=overdue',
  /** Opens today view with « En retard » section expanded (all sections still visible). */
  todayOverdue: '/tasks?view=today&group=overdue',
  assignedTermine: '/tasks?view=assigned&status=terminee',
} as const;

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

export function findProjectByName(
  projects: Projet[],
  name: string
): Projet | undefined {
  const target = normalizeName(name);
  return projects.find((p) => normalizeName(p.nom_p ?? '') === target);
}

/** Mon espace → project folder URL (ClickUp sidebar: dossier projet). */
export function buildMonEspaceProjectPath(
  spaces: SpaceTreeNode[],
  projectName = MEMBER_DASHBOARD_PROJECT_NAME
): string | null {
  const spaceId = findMonEspaceSpaceId(spaces);
  if (spaceId == null) return monEspacePathFromSpaces(spaces);

  const space = spaces.find((s) => s.id_space === spaceId);
  const target = normalizeName(projectName);
  const project = space?.projects?.find(
    (p) => normalizeName(p.nom_p ?? '') === target
  );

  if (project) {
    return appPaths.folder(spaceId, project.id_projet);
  }

  const first = space?.projects?.[0];
  if (first) {
    return appPaths.folder(spaceId, first.id_projet);
  }

  return appPaths.space(spaceId);
}

export async function resolveGestionProjetPath(
  projects: Projet[],
  projectName = MEMBER_DASHBOARD_PROJECT_NAME
): Promise<string> {
  try {
    const { spaces } = await spaceService.getHierarchy();
    const treePath = buildMonEspaceProjectPath(spaces, projectName);
    if (treePath) return treePath;

    const match = findProjectByName(projects, projectName);
    const spaceId = findMonEspaceSpaceId(spaces);
    if (match && spaceId != null) {
      return appPaths.folder(spaceId, match.id_projet);
    }
    return monEspacePathFromSpaces(spaces);
  } catch {
    return '/mon-espace';
  }
}

export async function navigateToGestionProjet(
  navigate: NavigateFunction,
  projects: Projet[]
): Promise<void> {
  const path = await resolveGestionProjetPath(projects);
  navigate(path);
}

export function parseMemberAssignedFiltersFromSearch(
  params: URLSearchParams
): MemberAssignedListFilters {
  const filters: MemberAssignedListFilters = { ...EMPTY_MEMBER_ASSIGNED_FILTERS };
  const due = params.get('due') as MemberDueDateFilter | null;
  if (due === 'overdue' || due === 'today' || due === 'week' || due === 'none') {
    filters.dueDate = due;
  }
  const status = params.get('status') as KanbanWorkflowColumnId | null;
  if (
    status === 'todo' ||
    status === 'en_cours' ||
    status === 'en_retard' ||
    status === 'terminee'
  ) {
    filters.status = status;
  }
  return filters;
}

export function parseTodayGroupFilter(
  params: URLSearchParams
): TodayWorkGroupKey | null {
  const raw = params.get('group');
  if (raw === 'overdue' || raw === 'today' || raw === 'next' || raw === 'unplanned') {
    return raw;
  }
  return null;
}
