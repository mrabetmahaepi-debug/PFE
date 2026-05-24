import dayjs from 'dayjs';
import 'dayjs/locale/fr';

dayjs.locale('fr');

export function formatTrashDeletedAt(iso: string): string {
  const d = dayjs(iso);
  if (!d.isValid()) return '';
  const now = dayjs();
  if (d.isSame(now, 'day')) return `Aujourd'hui à ${d.format('HH:mm')}`;
  if (d.isSame(now.subtract(1, 'day'), 'day')) {
    return `Hier à ${d.format('HH:mm')}`;
  }
  return d.format('D MMM YYYY à HH:mm');
}
