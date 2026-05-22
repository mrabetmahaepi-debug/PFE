/** SuperAdmin Activity History — whitelist of allowed action labels only. */

export const SUPER_ADMIN_ALLOWED_ACTIONS = [
  'Compte administrateur approuvé',
  'Compte administrateur activé',
  'Compte administrateur désactivé',
  'Administrateur invité',
  'Entreprise créée',
] as const;

export type SuperAdminAllowedAction = (typeof SUPER_ADMIN_ALLOWED_ACTIONS)[number];

const ALLOWED_SET = new Set<string>(SUPER_ADMIN_ALLOWED_ACTIONS);

/** Legacy / English labels mapped to the canonical French whitelist. */
const ACTION_ALIASES: Record<string, SuperAdminAllowedAction> = {
  'Admin invité': 'Administrateur invité',
  'Nouvelle entreprise créée': 'Entreprise créée',
  'Invitation administrateur approuvée': 'Compte administrateur approuvé',
  'Administrator invited': 'Administrateur invité',
  'Administrator account approved': 'Compte administrateur approuvé',
  'Administrator account activated': 'Compte administrateur activé',
  'Administrator account deactivated': 'Compte administrateur désactivé',
  'Company created': 'Entreprise créée',
};

const KEYWORD_INCLUDE_RE =
  /\b(admin|administrator|administrateur|company|entreprise)\b/i;
const KEYWORD_EXCLUDE_RE =
  /\b(project|projet|task|tâche|tache|sprint|team|équipe|equipe|member|membre|utilisateur)\b/i;

export function normalizeSuperAdminAction(
  action: string | null | undefined
): SuperAdminAllowedAction | null {
  const raw = String(action ?? '').trim();
  if (!raw) return null;
  if (ALLOWED_SET.has(raw)) return raw as SuperAdminAllowedAction;
  const mapped = ACTION_ALIASES[raw];
  return mapped ?? null;
}

function matchesSuperAdminKeywords(action: string | null | undefined): boolean {
  const text = String(action ?? '').trim();
  if (!text) return false;
  if (KEYWORD_EXCLUDE_RE.test(text)) return false;
  return KEYWORD_INCLUDE_RE.test(text);
}

/** Strict whitelist — Activity History & API-aligned feeds. */
export function isSuperAdminActivityVisible(activity: {
  action?: string | null;
}): boolean {
  return normalizeSuperAdminAction(activity.action) != null;
}

/** Dashboard « Activité plateforme » — whitelist + keyword fallback. */
export function isSuperAdminDashboardActivityVisible(activity: {
  action?: string | null;
}): boolean {
  if (normalizeSuperAdminAction(activity.action) != null) return true;
  return matchesSuperAdminKeywords(activity.action);
}

export function getSuperAdminActivityCategory(
  action: string | null | undefined
): 'admin' | 'enterprise' | null {
  const normalized = normalizeSuperAdminAction(action);
  if (!normalized) return null;
  if (normalized === 'Entreprise créée') return 'enterprise';
  return 'admin';
}
