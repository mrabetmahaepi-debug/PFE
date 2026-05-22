import type { Projet } from '../types/project';

/** Palette bleue alignée sur la carte « Projets par entreprise » */
export const PROJECTS_BY_COMPANY_COLORS = [
  '#0ea5e9',
  '#0284c7',
  '#38bdf8',
  '#0369a1',
  '#7dd3fc',
  '#0c4a6e',
] as const;

const NAMED_COMPANY_COLORS: Record<string, string> = {
  sakly: '#0ea5e9',
  mix: '#0284c7',
  epi: '#38bdf8',
  dev: '#0369a1',
  'system enterprise': '#7dd3fc',
  systementerprise: '#7dd3fc',
  porte: '#0c4a6e',
  'tech solutions': '#7dd3fc',
  techsolutions: '#7dd3fc',
};

export type CompanyProjectBar = {
  key: string;
  company: string;
  total: number;
  color: string;
};

export type ProjectsByCompanyInsights = {
  total: number;
  bars: CompanyProjectBar[];
};

function normalizeCompanyKey(name: string): string {
  return name.trim().toLowerCase();
}

export function resolveProjectCompanyName(project: Projet): string {
  const fromEntreprise = project.entreprise?.nom?.trim();
  if (fromEntreprise) return fromEntreprise;

  const legacy = (project as Projet & { company?: { name?: string | null } }).company?.name?.trim();
  if (legacy) return legacy;

  return 'Sans entreprise';
}

function colorForCompany(name: string, paletteIndex: number): string {
  const key = normalizeCompanyKey(name);
  if (NAMED_COMPANY_COLORS[key]) return NAMED_COMPANY_COLORS[key];
  return PROJECTS_BY_COMPANY_COLORS[paletteIndex % PROJECTS_BY_COMPANY_COLORS.length];
}

export function buildProjectsByCompanyInsights(projects: Projet[]): ProjectsByCompanyInsights {
  const projectStats = projects.reduce<Record<string, number>>((acc, project) => {
    const company = resolveProjectCompanyName(project);
    acc[company] = (acc[company] || 0) + 1;
    return acc;
  }, {});

  const sorted = Object.entries(projectStats).sort((a, b) => b[1] - a[1]);

  const bars: CompanyProjectBar[] = sorted.map(([company, total], index) => ({
    key: normalizeCompanyKey(company) || `company-${index}`,
    company,
    total,
    color: colorForCompany(company, index),
  }));

  const total = bars.reduce((sum, bar) => sum + bar.total, 0);

  return { total, bars };
}
