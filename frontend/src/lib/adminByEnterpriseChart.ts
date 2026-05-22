import type { User } from '../types/auth.types';

export const ADMIN_BY_ENTERPRISE_COLORS = [
  '#14b8a6',
  '#0ea5e9',
  '#8b5cf6',
  '#ec4899',
  '#22c55e',
  '#f59e0b',
] as const;

/** Couleurs nommées pour entreprises connues (normalisation insensible à la casse). */
const NAMED_ENTERPRISE_COLORS: Record<string, string> = {
  mix: '#14b8a6',
  sakly: '#0ea5e9',
  porte: '#8b5cf6',
  'tech solutions': '#ec4899',
  techsolutions: '#ec4899',
};

export type EnterpriseAdminSegment = {
  key: string;
  name: string;
  value: number;
  color: string;
};

export type AdminByEnterpriseInsights = {
  total: number;
  segments: EnterpriseAdminSegment[];
};

function normalizeEnterpriseKey(name: string): string {
  return name.trim().toLowerCase();
}

function rawGlobalRoleNom(member: User): string {
  if (typeof member.role === 'object' && member.role?.nom) {
    return member.role.nom;
  }
  return String(member.role ?? '');
}

function normalizeRoleKey(role: string): string {
  return role.trim().toUpperCase().replace(/\s+/g, '');
}

/** Administrateurs tenant (hors Super Admin plateforme). */
export function isTenantAdminMember(member: User): boolean {
  const key = normalizeRoleKey(rawGlobalRoleNom(member));
  if (!key || key === 'SUPERADMIN') return false;
  return (
    key === 'ADMIN' ||
    key === 'ADMINISTRATEUR' ||
    key === 'ADMINENTREPRISE' ||
    key.includes('ADMIN')
  );
}

export function resolveAdminEnterpriseName(member: User): string {
  const fromMembership = member.entreprise?.nom?.trim();
  if (fromMembership) return fromMembership;
  const adminOf = (member as User & { adminOf?: { nom?: string | null } }).adminOf;
  const fromAdminOf = adminOf?.nom?.trim();
  return fromAdminOf || 'Sans entreprise';
}

function colorForEnterprise(name: string, paletteIndex: number): string {
  const key = normalizeEnterpriseKey(name);
  if (NAMED_ENTERPRISE_COLORS[key]) return NAMED_ENTERPRISE_COLORS[key];
  return ADMIN_BY_ENTERPRISE_COLORS[paletteIndex % ADMIN_BY_ENTERPRISE_COLORS.length];
}

export function buildAdminByEnterpriseInsights(members: User[]): AdminByEnterpriseInsights {
  const admins = members.filter((m) => {
    if (!isTenantAdminMember(m)) return false;
    const statut = (m.statut ?? '').trim().toUpperCase();
    return statut !== 'REJECTED';
  });

  const companyStats = admins.reduce<Record<string, number>>((acc, admin) => {
    const company = resolveAdminEnterpriseName(admin);
    acc[company] = (acc[company] || 0) + 1;
    return acc;
  }, {});

  const sorted = Object.entries(companyStats).sort((a, b) => b[1] - a[1]);

  const segments: EnterpriseAdminSegment[] = sorted.map(([name, value], index) => ({
    key: normalizeEnterpriseKey(name) || `company-${index}`,
    name,
    value,
    color: colorForEnterprise(name, index),
  }));

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return { total, segments };
}

export function segmentPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}
