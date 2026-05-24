import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/** Task comment display timezone (Tunisia). */
export const TASK_COMMENT_TIMEZONE = 'Africa/Tunis';

/**
 * Format task comment `createdAt` (UTC ISO from API) in Tunisia local time.
 * - Aujourd'hui, HH:mm
 * - Hier, HH:mm
 * - DD/MM/YYYY, HH:mm
 */
export function formatTaskCommentDate(
  createdAt: string | null | undefined
): string {
  if (createdAt == null || String(createdAt).trim() === '') {
    return '—';
  }

  const d = dayjs.utc(createdAt).tz(TASK_COMMENT_TIMEZONE);
  if (!d.isValid()) {
    return '—';
  }

  const now = dayjs.utc().tz(TASK_COMMENT_TIMEZONE);
  const time = d.format('HH:mm');
  const dayKey = d.format('YYYY-MM-DD');

  if (dayKey === now.format('YYYY-MM-DD')) {
    return `Aujourd'hui, ${time}`;
  }
  if (dayKey === now.subtract(1, 'day').format('YYYY-MM-DD')) {
    return `Hier, ${time}`;
  }
  return `${d.format('DD/MM/YYYY')}, ${time}`;
}
