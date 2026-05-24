/**
 * Calendar-day due date helpers (YYYY-MM-DD).
 * Used by overdue notifications and workflow sync — keep in sync with frontend taskDueDate.ts.
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Extract intended calendar day from API/DB value (uses date portion of ISO strings). */
export function getTaskDueDateKey(
  raw?: Date | string | null
): string | null {
  if (raw == null || raw === '') return null;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    const iso = raw.toISOString();
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return `${raw.getFullYear()}-${pad2(raw.getMonth() + 1)}-${pad2(raw.getDate())}`;
  }

  return null;
}

export function getTodayDateKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** dueDate < today (calendar days). */
export function isPastDueCalendar(
  dateLimite?: Date | string | null,
  now: Date = new Date()
): boolean {
  const dueKey = getTaskDueDateKey(dateLimite);
  if (!dueKey) return false;
  return dueKey < getTodayDateKey(now);
}

export function isDueTodayCalendar(
  dateLimite?: Date | string | null,
  now: Date = new Date()
): boolean {
  const dueKey = getTaskDueDateKey(dateLimite);
  if (!dueKey) return false;
  return dueKey === getTodayDateKey(now);
}
