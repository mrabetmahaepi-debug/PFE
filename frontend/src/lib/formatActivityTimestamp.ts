/** Absolute French timestamp for activity feed (e.g. "13 mai, 18:20"). */
export function formatActivityTimestamp(isoDate: string | Date | null | undefined): string {
  if (!isoDate) return '';
  const date = isoDate instanceof Date ? isoDate : new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const formatted = date.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return formatted.replace(/\s+à\s+/, ', ');
}
