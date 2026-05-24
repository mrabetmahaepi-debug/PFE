import type { User } from '../types/auth.types';

export type UserLike = Record<string, unknown> | User | null | undefined;

/** Stable numeric id from API payloads (id_utilisateur, userId, id…). */
export function pickerUserId(raw: UserLike): number {
  if (!raw || typeof raw !== 'object') return 0;
  const r = raw as Record<string, unknown>;
  const n = Number(
    r.id_utilisateur ?? r.userId ?? r.user_id ?? r.id ?? 0,
  );
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Map API / projectTeam rows to a consistent User shape for pickers. */
export function normalizePickerUser(raw: UserLike): User {
  if (!raw || typeof raw !== 'object') {
    return { id: 0, email: '' };
  }
  const r = raw as Record<string, unknown>;
  const id = pickerUserId(r);
  const prenom = String(
    r.prenom ?? r.firstName ?? r.first_name ?? '',
  ).trim();
  const nom = String(r.nom ?? r.lastName ?? r.last_name ?? '').trim();
  const name = String(r.name ?? r.fullName ?? r.full_name ?? '').trim();
  const email = String(r.email ?? '').trim();
  return {
    id: id || 0,
    id_utilisateur: id || undefined,
    prenom: prenom || undefined,
    nom: nom || undefined,
    name: name || undefined,
    email,
  };
}

/** Display name only — fullName → first+last → name → email. */
export function formatUserDisplayName(u: UserLike): string {
  const n = normalizePickerUser(u);
  const firstLast = `${n.prenom ?? ''} ${n.nom ?? ''}`.trim();
  const fullName = (n.name ?? '').trim();
  if (fullName) return fullName;
  if (firstLast) return firstLast;
  if (n.email?.trim()) return n.email.trim();
  return '';
}

/** Picker label: « Prénom Nom — email » (never « Utilisateur #id »). */
export function formatUserPickerLabel(u: UserLike): string {
  const n = normalizePickerUser(u);
  const name = formatUserDisplayName(n);
  const email = (n.email ?? '').trim();
  if (name && email && name !== email) return `${name} — ${email}`;
  return name || email || '';
}

export function normalizePickerUserList(raw: unknown): User[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => normalizePickerUser(row as UserLike));
}
