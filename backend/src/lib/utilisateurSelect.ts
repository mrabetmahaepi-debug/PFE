/**
 * Columns that exist before optional presence migrations.
 * Use these in `select` so Prisma does not SELECT missing DB columns.
 */
export const utilisateurCoreSelect = {
  id_utilisateur: true,
  nom: true,
  prenom: true,
  email: true,
  password: true,
  id_role: true,
  id_entreprise: true,
  poste: true,
  telephone: true,
  statut: true,
  createdAt: true,
  lastLogin: true,
  photoUrl: true,
} as const;

/** Team / directory listing: no password. */
export const utilisateurListCoreSelect = {
  id_utilisateur: true,
  nom: true,
  prenom: true,
  email: true,
  id_role: true,
  id_entreprise: true,
  poste: true,
  telephone: true,
  statut: true,
  createdAt: true,
  lastLogin: true,
  photoUrl: true,
  role: true,
  entreprise: true,
} as const;

export const utilisateurPresenceSelect = {
  isOnline: true,
  lastSeen: true,
} as const;

export const roleNomSelect = { nom: true } as const;

/**
 * Login / credential check only — avoids optional columns (photoUrl, lastLogin,
 * presence, …) that may be absent on older DBs and would break Prisma reads.
 */
export const utilisateurMinimalAuthSelect = {
  id_utilisateur: true,
  nom: true,
  prenom: true,
  email: true,
  password: true,
  id_role: true,
  id_entreprise: true,
  statut: true,
  poste: true,
  role: { select: roleNomSelect },
} as const;

export const roleMeSelect = {
  nom: true,
  permission: { select: { nom: true } },
} as const;

/** Chef / admin display on project lists — avoids SELECT on missing presence columns. */
export const utilisateurPublicChefSelect = {
  id_utilisateur: true,
  nom: true,
  prenom: true,
  email: true,
  id_role: true,
  id_entreprise: true,
  role: { select: { nom: true, id_role: true } },
} as const;
