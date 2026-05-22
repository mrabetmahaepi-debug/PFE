/** Origin for static uploads (no /api suffix). */
export function getApiOrigin(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().replace(/\/+$/, '').replace(/\/api$/i, '');
  }
  if (import.meta.env.DEV) {
    return '';
  }
  return 'http://127.0.0.1:5000';
}

export function resolveProfilePhotoUrl(
  photoUrl?: string | null
): string | null {
  if (!photoUrl?.trim()) return null;
  const path = photoUrl.trim();
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  const origin = getApiOrigin();
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getUserInitials(
  user?: { prenom?: string; nom?: string; email?: string } | null
): string {
  const p = user?.prenom?.[0] ?? '';
  const n = user?.nom?.[0] ?? '';
  const fromName = `${p}${n}`.toUpperCase();
  if (fromName) return fromName;
  return (user?.email?.[0] ?? '?').toUpperCase();
}
