import type { Tache } from '../types/task';
import { normalizeTaskStatutKey } from './listStatusGroups';

/**
 * Calendar-day due date helpers (YYYY-MM-DD).
 * Single source for Member « Aujourd'hui et en retard » and overdue checks.
 * Keep in sync with backend/src/lib/taskDueCalendar.ts.
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Extract intended calendar day from API value (date portion of ISO strings). */
export function getTaskDueDateKey(raw?: string | null): string | null {
  if (raw == null || raw === '') return null;
  const trimmed = String(raw).trim();
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
}

export function getTodayDateKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function isMemberTaskDone(t: Tache): boolean {
  return normalizeTaskStatutKey(t.statut_t) === 'terminee';
}

/** Overdue: dueDate < today AND not terminé. */
export function isMemberTaskOverdue(t: Tache, now: Date = new Date()): boolean {
  if (isMemberTaskDone(t)) return false;
  const dueKey = getTaskDueDateKey(t.date_limite_t);
  if (!dueKey) return false;
  return dueKey < getTodayDateKey(now);
}

/** Due on today's calendar day, not terminé. */
export function isDueToday(t: Tache, now: Date = new Date()): boolean {
  if (isMemberTaskDone(t)) return false;
  const dueKey = getTaskDueDateKey(t.date_limite_t);
  if (!dueKey) return false;
  return dueKey === getTodayDateKey(now);
}

/** Due after today, not terminé. */
export function isDueAfterToday(t: Tache, now: Date = new Date()): boolean {
  if (isMemberTaskDone(t)) return false;
  const dueKey = getTaskDueDateKey(t.date_limite_t);
  if (!dueKey) return false;
  return dueKey > getTodayDateKey(now);
}

export function hasNoDueDate(t: Tache): boolean {
  return getTaskDueDateKey(t.date_limite_t) === null;
}

export type MemberTodayGroupKey = 'overdue' | 'today' | 'next' | 'unplanned';

/**
 * Classify into exactly one group (mutually exclusive).
 * En retard: due &lt; today and not terminé.
 * Aujourd'hui: due === today.
 * Suivant: due &gt; today.
 * Non planifié: no due date (terminé without due also lands here).
 */
export function classifyMemberTodayGroup(
  t: Tache,
  now: Date = new Date()
): MemberTodayGroupKey {
  const dueKey = getTaskDueDateKey(t.date_limite_t);
  if (!dueKey) return 'unplanned';

  const todayKey = getTodayDateKey(now);
  if (dueKey < todayKey) {
    if (!isMemberTaskDone(t)) return 'overdue';
    return 'today';
  }
  if (dueKey === todayKey) return 'today';
  if (dueKey > todayKey) return 'next';
  return 'unplanned';
}

/** @deprecated use getTaskDueDateKey — kept for done-tab filter */
export function getDueDateLocalStart(raw?: string | null): Date | null {
  const key = getTaskDueDateKey(raw);
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
