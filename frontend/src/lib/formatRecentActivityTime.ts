import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/fr';

dayjs.extend(relativeTime);
dayjs.locale('fr');

/** Relative French timestamp for « Activité récente » feeds. */
export function formatRecentActivityTime(
  isoDate: string | Date | null | undefined,
  now: dayjs.Dayjs = dayjs()
): string {
  if (!isoDate) return '';
  const d = dayjs(isoDate);
  if (!d.isValid()) return '';

  const diffSec = now.diff(d, 'second');
  const diffMin = now.diff(d, 'minute');
  const diffHour = now.diff(d, 'hour');

  if (diffSec < 60) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffHour < 24) return `il y a ${diffHour} h`;

  if (d.isSame(now.subtract(1, 'day'), 'day')) return 'Hier';

  return d.format('DD/MM/YYYY HH:mm');
}
