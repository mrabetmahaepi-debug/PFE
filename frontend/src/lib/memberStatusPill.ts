import type { KanbanWorkflowColumnId } from './kanbanWorkflowColumns';
import { normalizeTaskStatutKey } from './listStatusGroups';
import type { MemberTodayGroupKey } from './taskDueDate';
import { TaskPriority, normalizeTaskPriority } from '../types/task';

export type MemberStatusPillTone = 'gray' | 'purple' | 'amber' | 'green';

/** Pill modifier class (pair with `.member-status-pill`). */
export function memberStatusPillClass(tone: MemberStatusPillTone): string {
  return `member-status-pill member-status-pill--${tone}`;
}

/** Select in list status column — same tones as pills. */
export function memberStatusSelectClass(tone: MemberStatusPillTone): string {
  return `member-status-pill member-status-pill--${tone} member-status-select`;
}

const WORKFLOW_LABELS: Record<string, string> = {
  todo: 'À FAIRE',
  todo_open: 'À FAIRE',
  en_cours: 'EN COURS',
  en_retard: 'EN RETARD',
  terminee: 'TERMINÉ',
};

/** Uppercase workflow label for member status badges. */
export function memberWorkflowStatusLabel(statutKey: string): string {
  const k = normalizeTaskStatutKey(statutKey);
  return WORKFLOW_LABELS[k] ?? String(statutKey ?? '—').toUpperCase();
}

export function kanbanColumnToPillTone(
  columnId: KanbanWorkflowColumnId
): MemberStatusPillTone {
  switch (columnId) {
    case 'en_cours':
      return 'purple';
    case 'en_retard':
      return 'amber';
    case 'terminee':
      return 'green';
    default:
      return 'gray';
  }
}

export function statutKeyToPillTone(statutKey: string): MemberStatusPillTone {
  const k = normalizeTaskStatutKey(statutKey);
  if (k === 'en_cours') return 'purple';
  if (k === 'en_retard') return 'amber';
  if (k === 'terminee') return 'green';
  return 'gray';
}

/** Date-based groups on « Aujourd'hui et en retard ». */
export function todayGroupKeyToPillTone(
  key: MemberTodayGroupKey
): MemberStatusPillTone {
  switch (key) {
    case 'overdue':
      return 'amber';
    case 'today':
      return 'purple';
    case 'next':
      return 'purple';
    case 'unplanned':
    default:
      return 'gray';
  }
}

export type MemberPriorityPillTone = 'high' | 'medium' | 'low';

export function memberPriorityTextClass(tone: MemberPriorityPillTone): string {
  return `member-priority-text member-priority-text--${tone}`;
}

export function taskPriorityToPillTone(
  priority?: string | null
): MemberPriorityPillTone {
  const p = normalizeTaskPriority(priority);
  if (p === TaskPriority.HIGH || p === TaskPriority.URGENT) return 'high';
  if (p === TaskPriority.LOW) return 'low';
  return 'medium';
}

/** Member list table — Haute / Moyenne / Basse only. */
export function memberListPriorityLabel(priority?: string | null): string {
  const p = normalizeTaskPriority(priority);
  if (p === TaskPriority.HIGH || p === TaskPriority.URGENT) return 'Haute';
  if (p === TaskPriority.LOW) return 'Basse';
  return 'Moyenne';
}

export const MEMBER_LIST_PRIORITY_OPTIONS: {
  value: TaskPriority;
  label: string;
}[] = [
  { value: TaskPriority.HIGH, label: 'Haute' },
  { value: TaskPriority.MEDIUM, label: 'Moyenne' },
  { value: TaskPriority.LOW, label: 'Basse' },
];

export function memberListPriorityValue(priority?: string | null): TaskPriority {
  const p = normalizeTaskPriority(priority);
  if (p === TaskPriority.HIGH || p === TaskPriority.URGENT) return TaskPriority.HIGH;
  if (p === TaskPriority.LOW) return TaskPriority.LOW;
  return TaskPriority.MEDIUM;
}
