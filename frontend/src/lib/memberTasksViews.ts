import type { Tache } from '../types/task';
import {
  classifyMemberTodayGroup,
  getTaskDueDateKey,
  getTodayDateKey,
  isDueToday,
  isMemberTaskDone,
  isMemberTaskOverdue,
  type MemberTodayGroupKey,
} from './taskDueDate';

export type MemberTasksView = 'assigned' | 'today';

export const MEMBER_TASKS_VIEWS: {
  id: MemberTasksView;
  labelKey: string;
  path: string;
}[] = [
  { id: 'assigned', labelKey: 'tasks.viewAssigned', path: '/tasks?view=assigned' },
  { id: 'today', labelKey: 'tasks.viewTodayOverdue', path: '/tasks?view=today' },
];

export function parseMemberTasksView(
  raw: string | null | undefined
): MemberTasksView {
  if (raw === 'today') return 'today';
  return 'assigned';
}

/** Exact active check for Mes tâches sidebar links (pathname + view query). */
export function isMemberTasksViewActive(
  pathname: string,
  search: string,
  viewId: MemberTasksView
): boolean {
  if (pathname !== '/tasks') return false;
  const params = new URLSearchParams(search);
  return parseMemberTasksView(params.get('view')) === viewId;
}

/** Tasks assigned to the current member only. */
export function filterTasksAssignedToMember(
  tasks: Tache[],
  userId?: number
): Tache[] {
  if (userId == null || !Number.isFinite(userId)) return tasks;
  const uid = Number(userId);
  return tasks.filter((t) => Number(t.assigne_a) === uid);
}

/** Non-completed tasks due today or overdue (sidebar badge). */
export function filterTodayAndOverdue(tasks: Tache[]): Tache[] {
  return tasks.filter((t) => isMemberTaskOverdue(t) || isDueToday(t));
}

export function countTodayAndOverdue(tasks: Tache[]): number {
  return filterTodayAndOverdue(tasks).length;
}

export function filterByMemberView(
  tasks: Tache[],
  view: MemberTasksView,
  userId?: number
): Tache[] {
  const mine = filterTasksAssignedToMember(tasks, userId);
  if (view === 'today') return filterTodayAndOverdue(mine);
  return mine;
}

export type TodayWorkGroupKey = MemberTodayGroupKey;

/** Display order: overdue first, then today. */
export const TODAY_WORK_GROUPS: {
  key: TodayWorkGroupKey;
  label: string;
}[] = [
  { key: 'overdue', label: 'En retard' },
  { key: 'today', label: 'Aujourd\'hui' },
  { key: 'next', label: 'Suivant' },
  { key: 'unplanned', label: 'Non planifié' },
];

/** Classify using unified calendar-day rules (re-export). */
export function classifyTodayWorkTask(
  t: Tache,
  now?: Date
): TodayWorkGroupKey {
  return classifyMemberTodayGroup(t, now);
}

/** Group counts for the today page (recalculated from tasks each render). */
export function groupMemberTodayTasks(
  tasks: Tache[],
  now?: Date
): Map<TodayWorkGroupKey, Tache[]> {
  const map = new Map<TodayWorkGroupKey, Tache[]>();
  for (const g of TODAY_WORK_GROUPS) map.set(g.key, []);
  for (const t of tasks) {
    const key = classifyTodayWorkTask(t, now);
    map.get(key)!.push(t);
  }
  return map;
}

/** Non-completed assigned tasks for « À faire » tab. */
export function filterMemberTodayTodoTasks(tasks: Tache[]): Tache[] {
  return tasks.filter((t) => !isMemberTaskDone(t));
}

/** Done tasks for « Terminé » tab. */
export function filterTodayPageTab(
  tasks: Tache[],
  tab: 'todo' | 'done' | 'delegated',
  userId?: number
): Tache[] {
  const mine = filterTasksAssignedToMember(tasks, userId);

  if (tab === 'done') {
    const todayKey = getTodayDateKey();
    return mine.filter((t) => {
      if (!isMemberTaskDone(t)) return false;
      const dueKey = getTaskDueDateKey(t.date_limite_t);
      if (!dueKey) return false;
      return dueKey <= todayKey;
    });
  }

  if (tab === 'delegated') {
    return mine.filter((t) => {
      if (isMemberTaskDone(t)) return false;
      if (userId == null) return false;
      const createdByMe = t.createur?.id_utilisateur === userId;
      const assignedToMe = Number(t.assigne_a) === Number(userId);
      return createdByMe && !assignedToMe;
    });
  }

  return filterMemberTodayTodoTasks(mine);
}
