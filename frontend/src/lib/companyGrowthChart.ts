import type { Entreprise } from '../services/entreprise.service';

export type CompanyGrowthPoint = {
  key: string;
  month: string;
  total: number;
  sortKey: string;
};

export type CompanyGrowthInsights = {
  total: number;
  points: CompanyGrowthPoint[];
};

function parseCreatedAt(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthSortKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatMonthLabel(date: Date): string {
  const label = date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function buildCompanyGrowthInsights(companies: Entreprise[]): CompanyGrowthInsights {
  const monthlyStats = new Map<string, { count: number; label: string; sortKey: string }>();

  for (const company of companies) {
    const created = parseCreatedAt(company.createdAt);
    if (!created) continue;

    const sortKey = monthSortKey(created);
    const label = formatMonthLabel(created);
    const existing = monthlyStats.get(sortKey);
    if (existing) {
      existing.count += 1;
    } else {
      monthlyStats.set(sortKey, { count: 1, label, sortKey });
    }
  }

  const points: CompanyGrowthPoint[] = [...monthlyStats.values()]
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((entry) => ({
      key: entry.sortKey,
      month: entry.label,
      total: entry.count,
      sortKey: entry.sortKey,
    }));

  return {
    total: companies.length,
    points,
  };
}
