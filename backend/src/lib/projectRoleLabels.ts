/**
 * Libellés de poste / rôle projet (membre_projet.role_projet, utilisateur.poste).
 * Source unique pour invitations et équipes projet.
 */
/** Profils proposés lors d'une invitation équipe (admin). */
export const INVITATION_PROFILE_OPTIONS = [
  "Chef de projet",
  "Développeur",
] as const;

/** Rôles assignables par projet (membre_projet.role_projet) — distinct du profil global. */
export const PROJECT_LOCAL_ROLE_OPTIONS = [
  "Chef de projet",
  "Développeur",
] as const;

export type ProjectLocalRoleOption = (typeof PROJECT_LOCAL_ROLE_OPTIONS)[number];

export type InvitationProfileOption = (typeof INVITATION_PROFILE_OPTIONS)[number];

export const PROJECT_POSTE_OPTIONS = [
  "Chef de projet",
  "Développeur",
  "Testeur",
  "Designer",
  "Scrum Master",
  "Product Owner",
  "Analyste",
  "Membre",
] as const;

export type ProjectPosteOption = (typeof PROJECT_POSTE_OPTIONS)[number];

const NORMALIZE = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const CANONICAL_BY_KEY = new Map<string, ProjectPosteOption>(
  PROJECT_POSTE_OPTIONS.map((label) => [NORMALIZE(label), label])
);

/** Alias → libellé canonique (ex. « Chef de Projet » historique). */
const ALIASES: Record<string, ProjectPosteOption> = {
  "chef de projet": "Chef de projet",
  "project manager": "Chef de projet",
  "pm": "Chef de projet",
  developpeur: "Développeur",
  developer: "Développeur",
  dev: "Développeur",
  testeur: "Testeur",
  tester: "Testeur",
  qa: "Testeur",
  designer: "Designer",
  design: "Designer",
  "scrum master": "Scrum Master",
  scrum: "Scrum Master",
  "product owner": "Product Owner",
  po: "Product Owner",
  analyste: "Analyste",
  analyst: "Analyste",
  membre: "Membre",
  member: "Membre",
  autre: "Membre",
};

export function resolveProjectPosteLabel(
  raw: string | null | undefined
): ProjectPosteOption {
  if (!raw || !String(raw).trim()) return "Membre";
  const key = NORMALIZE(raw);
  const direct = CANONICAL_BY_KEY.get(key);
  if (direct) return direct;
  const alias = ALIASES[key];
  if (alias) return alias;
  if (key.includes("chef") && key.includes("projet")) return "Chef de projet";
  if (key.includes("developpeur") || key.includes("developer"))
    return "Développeur";
  if (key.includes("testeur") || key.includes("tester") || key.includes("qa"))
    return "Testeur";
  if (key.includes("design")) return "Designer";
  if (key.includes("scrum")) return "Scrum Master";
  if (key.includes("product") && key.includes("owner")) return "Product Owner";
  if (key.includes("analyst")) return "Analyste";
  return "Membre";
}

export function isValidInvitationProfileLabel(raw: string): boolean {
  if (!raw || !String(raw).trim()) return false;
  const resolved = resolveProjectPosteLabel(raw);
  return (
    resolved === "Chef de projet" || resolved === "Développeur"
  );
}

export function isValidProjectPosteLabel(raw: string): boolean {
  if (!raw || !String(raw).trim()) return false;
  const key = NORMALIZE(raw);
  if (CANONICAL_BY_KEY.has(key)) return true;
  if (ALIASES[key]) return true;
  if (key.includes("chef") && key.includes("projet")) return true;
  if (key.includes("developpeur") || key.includes("developer")) return true;
  if (key.includes("testeur") || key.includes("tester")) return true;
  if (key.includes("design")) return true;
  if (key.includes("scrum")) return true;
  if (key.includes("product") && key.includes("owner")) return true;
  if (key.includes("analyst")) return true;
  return key === "membre" || key === "member";
}

export function isChefDeProjetPoste(
  poste: string | null | undefined
): boolean {
  return resolveProjectPosteLabel(poste) === "Chef de projet";
}

export function isDeveloppeurPoste(
  poste: string | null | undefined
): boolean {
  return resolveProjectPosteLabel(poste) === "Développeur";
}

/** True when `membre_projet.role_projet` is a chef de projet label. */
/** Normalise un rôle local projet (Chef de projet ou Développeur uniquement). */
export function normalizeProjectLocalRole(
  raw: string | null | undefined
): ProjectLocalRoleOption {
  return resolveProjectPosteLabel(raw) === "Chef de projet"
    ? "Chef de projet"
    : "Développeur";
}

export function isChefDeProjetMemberRole(
  roleProjet: string | null | undefined
): boolean {
  if (!roleProjet || !String(roleProjet).trim()) return false;
  const key = NORMALIZE(roleProjet);
  if (key.includes("chef") && key.includes("projet")) return true;
  return resolveProjectPosteLabel(roleProjet) === "Chef de projet";
}
