import type { Tache } from '../types/task';
import { TaskPriority, normalizeTaskPriority } from '../types/task';
import { normalizeTaskStatutKey } from './listStatusGroups';
import {
  getTaskDueDateKey,
  getTodayDateKey,
  isMemberTaskOverdue,
} from './taskDueDate';
import {
  KANBAN_WORKFLOW_COLUMNS,
  type KanbanWorkflowColumnId,
} from './kanbanWorkflowColumns';

export type MemberPriorityFilter = 'high' | 'medium' | 'low';

export type MemberDueDateFilter = 'today' | 'overdue' | 'week' | 'none';

export type MemberAssignedListFilters = {
  priority: MemberPriorityFilter | null;
  dueDate: MemberDueDateFilter | null;
  /** null = no status constraint (e.g. « Tous les statuts »). */
  status: KanbanWorkflowColumnId | null;
  /** User chose « Tous les statuts » — include terminé and all workflow groups. */
  allStatuses: boolean;
};

export const EMPTY_MEMBER_ASSIGNED_FILTERS: MemberAssignedListFilters = {
  priority: null,
  dueDate: null,
  status: null,
  allStatuses: false,
};

export const MEMBER_PRIORITY_FILTER_LABELS: Record<MemberPriorityFilter, string> = {
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
};

export const MEMBER_STATUS_ALL_LABEL = 'Tous les statuts';

export const MEMBER_DUE_DATE_FILTER_LABELS: Record<MemberDueDateFilter, string> = {
  today: "Aujourd'hui",
  overdue: 'En retard',
  week: 'Cette semaine',
  none: 'Sans date',
};

export function getMemberStatusFilterLabel(
  status: KanbanWorkflowColumnId
): string {
  return (
    KANBAN_WORKFLOW_COLUMNS.find((c) => c.id === status)?.label ?? status
  );
}

export function hasActiveMemberAssignedFilters(
  filters: MemberAssignedListFilters
): boolean {
  return (
    filters.priority != null ||
    filters.dueDate != null ||
    filters.status != null
  );
}

/** Same rule as dashboard « Terminées » card (assigné à moi + statut terminé). */
export function countMemberTermineeTasks(tasks: Tache[]): number {
  return tasks.filter((t) => normalizeTaskStatutKey(t.statut_t) === 'terminee').length;
}

/** « Fermé » off hides terminé unless user filters for TERMINÉ or « Tous les statuts ». */
export function shouldHideMemberAssignedCompleted(
  filters: MemberAssignedListFilters,
  showClosed: boolean
): boolean {
  if (showClosed || filters.allStatuses) return false;
  if (filters.status === 'terminee') return false;
  return true;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const end = new Date(y, m - 1, d + days);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`;
}

/** Map task priority to filter bucket (Haute / Moyenne / Basse). */
export function getMemberPriorityBucket(
  priorite?: string | null
): MemberPriorityFilter {
  const p = normalizeTaskPriority(priorite);
  if (p === TaskPriority.HIGH || p === TaskPriority.URGENT) return 'high';
  if (p === TaskPriority.LOW) return 'low';
  return 'medium';
}

export function matchesMemberAssignedPriority(
  task: Tache,
  filter: MemberPriorityFilter
): boolean {
  return getMemberPriorityBucket(task.priorite_t) === filter;
}

export function matchesMemberAssignedDueDate(
  task: Tache,
  filter: MemberDueDateFilter
): boolean {
  const dueKey = getTaskDueDateKey(task.date_limite_t);
  const todayKey = getTodayDateKey();

  if (filter === 'none') {
    return dueKey === null;
  }

  if (!dueKey) return false;

  if (filter === 'today') {
    return dueKey === todayKey;
  }

  if (filter === 'overdue') {
    return isMemberTaskOverdue(task);
  }

  if (filter === 'week') {
    const weekEndKey = addDaysToDateKey(todayKey, 7);
    return dueKey >= todayKey && dueKey <= weekEndKey;
  }

  return false;
}

export function matchesMemberAssignedStatus(
  task: Tache,
  filter: KanbanWorkflowColumnId
): boolean {
  const key = normalizeTaskStatutKey(task.statut_t);
  if (filter === 'todo') {
    return key === 'todo' || key === 'todo_open';
  }
  return key === filter;
}

/** AND logic: priority + due date + optional status (skipped when status is null). */
export function taskMatchesMemberAssignedFilters(
  task: Tache,
  filters: MemberAssignedListFilters
): boolean {
  if (filters.priority && !matchesMemberAssignedPriority(task, filters.priority)) {
    return false;
  }
  if (filters.dueDate && !matchesMemberAssignedDueDate(task, filters.dueDate)) {
    return false;
  }
  if (filters.status != null && !matchesMemberAssignedStatus(task, filters.status)) {
    return false;
  }
  return true;
}

export function applyMemberAssignedFilters(
  tasks: Tache[],
  filters: MemberAssignedListFilters
): Tache[] {
  return tasks.filter((t) => taskMatchesMemberAssignedFilters(t, filters));
}

export type MemberAssignedListFilterOptions = {
  searchQuery?: string;
  /** When true (Fermé off), hide terminé unless « Tous les statuts » is active. */
  hideCompleted?: boolean;
};

/** Full Assigné à moi list pipeline (toolbar filters → search → Fermé). */
export function filterMemberAssignedTaskList(
  tasks: Tache[],
  filters: MemberAssignedListFilters,
  opts: MemberAssignedListFilterOptions = {}
): Tache[] {
  let list = applyMemberAssignedFilters(tasks, filters);

  const q = (opts.searchQuery ?? '').trim().toLowerCase();
  if (q) {
    list = list.filter((t) => (t.nom_t || '').toLowerCase().includes(q));
  }

  if (shouldHideMemberAssignedCompleted(filters, !opts.hideCompleted)) {
    list = list.filter(
      (t) => normalizeTaskStatutKey(t.statut_t) !== 'terminee'
    );
  }

  return list;
}

export type MemberAssignedStatusGroup = {
  id: KanbanWorkflowColumnId;
  label: string;
  tasks: Tache[];
};

/** Group filtered tasks by workflow status; omit empty groups. */
export function groupMemberAssignedTasksByStatus(
  tasks: Tache[]
): MemberAssignedStatusGroup[] {
  const buckets = new Map<KanbanWorkflowColumnId, Tache[]>();
  for (const col of KANBAN_WORKFLOW_COLUMNS) {
    buckets.set(col.id, []);
  }

  for (const t of tasks) {
    const key = normalizeTaskStatutKey(t.statut_t);
    let colId: KanbanWorkflowColumnId = 'todo';
    if (key === 'en_cours') colId = 'en_cours';
    else if (key === 'en_retard') colId = 'en_retard';
    else if (key === 'terminee') colId = 'terminee';
    else if (key === 'todo' || key === 'todo_open') colId = 'todo';
    buckets.get(colId)!.push(t);
  }

  return KANBAN_WORKFLOW_COLUMNS.map((col) => ({
    id: col.id,
    label: col.label,
    tasks: buckets.get(col.id) ?? [],
  })).filter((g) => g.tasks.length > 0);
}

export function formatMemberAssignedFilterSummary(
  filters: MemberAssignedListFilters
): string | null {
  if (!hasActiveMemberAssignedFilters(filters)) return null;
  const parts: string[] = [];
  if (filters.priority) {
    parts.push(MEMBER_PRIORITY_FILTER_LABELS[filters.priority]);
  }
  if (filters.dueDate) {
    parts.push(MEMBER_DUE_DATE_FILTER_LABELS[filters.dueDate]);
  }
  if (filters.status) {
    parts.push(getMemberStatusFilterLabel(filters.status));
  }
  return parts.join(' · ');
}
