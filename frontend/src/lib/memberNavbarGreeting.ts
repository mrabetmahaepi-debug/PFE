/** Formatted date for admin navbar (e.g. Samedi, 24 Mai 2026). */
export function formatAdminNavbarDate(date = new Date()): string {
  const weekdayRaw = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(date);
  const weekday =
    weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);

  const rest = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

  const restFormatted = rest
    .split(' ')
    .map((word) => (/\d/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');

  return `${weekday}, ${restFormatted}`;
}

/** Formatted date for member navbar (e.g. Samedi 23 Mai 2026). */
export function formatMemberNavbarDate(date = new Date()): string {
  const formatted = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return formatted
    .split(' ')
    .map((word) => (/\d/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

export function memberDisplayName(user: {
  prenom?: string | null;
  nom?: string | null;
  name?: string | null;
  email?: string | null;
} | null | undefined): string {
  const full = [user?.prenom, user?.nom].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (user?.name?.trim()) return user.name.trim();
  return user?.email?.split('@')[0] || 'Membre';
}

/** First name or display name for tenant admin navbar greeting. */
export function adminDashboardDisplayName(user: {
  prenom?: string | null;
  name?: string | null;
} | null | undefined): string {
  if (user?.prenom?.trim()) return user.prenom.trim();
  if (user?.name?.trim()) return user.name.trim();
  return 'Admin';
}
