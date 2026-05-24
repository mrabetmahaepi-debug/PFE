/** Rôles locaux au projet (membre_projet) — Admin peut assigner par projet. */
export const PROJECT_LOCAL_ROLE_OPTIONS = ['Chef de projet', 'Développeur'] as const;

export type ProjectLocalRoleOption = (typeof PROJECT_LOCAL_ROLE_OPTIONS)[number];

/** Rôle par défaut pour un membre additionnel (hors responsable). */
export const PROJECT_LOCAL_MEMBER_ROLE_OPTIONS = ['Développeur'] as const;

/** Libellés de poste / rôle projet — alignés sur le backend. */
export const PROJECT_POSTE_OPTIONS = [
  'Chef de projet',
  'Développeur',
  'Testeur',
  'Designer',
  'Scrum Master',
  'Product Owner',
  'Analyste',
  'Membre',
] as const;

export type ProjectPosteOption = (typeof PROJECT_POSTE_OPTIONS)[number];

const NORMALIZE = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const CANONICAL_BY_KEY = new Map<string, ProjectPosteOption>(
  PROJECT_POSTE_OPTIONS.map((label) => [NORMALIZE(label), label])
);

const ALIASES: Record<string, ProjectPosteOption> = {
  chef_projet: 'Chef de projet',
  'chef de projet': 'Chef de projet',
  'project manager': 'Chef de projet',
  pm: 'Chef de projet',
  developpeur: 'Développeur',
  developer: 'Développeur',
  dev: 'Développeur',
  testeur: 'Testeur',
  tester: 'Testeur',
  qa: 'Testeur',
  designer: 'Designer',
  design: 'Designer',
  'scrum master': 'Scrum Master',
  scrum: 'Scrum Master',
  'product owner': 'Product Owner',
  po: 'Product Owner',
  analyste: 'Analyste',
  analyst: 'Analyste',
  membre: 'Membre',
  member: 'Membre',
  autre: 'Membre',
};

export function resolveProjectPosteLabel(
  raw: string | null | undefined
): ProjectPosteOption {
  if (!raw || !String(raw).trim()) return 'Membre';
  const key = NORMALIZE(raw);
  const direct = CANONICAL_BY_KEY.get(key);
  if (direct) return direct;
  const alias = ALIASES[key];
  if (alias) return alias;
  if (key.includes('chef') && key.includes('projet')) return 'Chef de projet';
  if (key.includes('developpeur') || key.includes('developer'))
    return 'Développeur';
  if (key.includes('testeur') || key.includes('tester') || key.includes('qa'))
    return 'Testeur';
  if (key.includes('design')) return 'Designer';
  if (key.includes('scrum')) return 'Scrum Master';
  if (key.includes('product') && key.includes('owner')) return 'Product Owner';
  if (key.includes('analyst')) return 'Analyste';
  return 'Membre';
}

/** Normalise le rôle local d'un membre (Chef de projet ou Développeur). */
export function normalizeProjectLocalRole(
  raw: string | null | undefined
): ProjectLocalRoleOption {
  return resolveProjectPosteLabel(raw) === 'Chef de projet' ? 'Chef de projet' : 'Développeur';
}

/** True when `membre_projet.role_projet` is a chef de projet label. */
export function isChefDeProjetMemberRole(
  roleProjet: string | null | undefined
): boolean {
  if (!roleProjet || !String(roleProjet).trim()) return false;
  const key = NORMALIZE(roleProjet);
  if (key.includes('chef') && key.includes('projet')) return true;
  return resolveProjectPosteLabel(roleProjet) === 'Chef de projet';
}
