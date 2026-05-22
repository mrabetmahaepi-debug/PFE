import type { Entreprise } from '../services/entreprise.service';

function isAdminRole(roleName: string | null | undefined): boolean {
  const norm = String(roleName ?? '')
    .trim()
    .toLowerCase();
  if (!norm) return false;
  return (
    norm === 'admin' ||
    norm === 'administrateur' ||
    norm === 'administrator' ||
    norm.includes('admin')
  );
}

/** Stable key for admin rows (edit drafts, React keys). */
export function adminKey(admin: NonNullable<Entreprise['admin']>): string {
  return String(admin.id_utilisateur ?? admin.email ?? `${admin.prenom}-${admin.nom}`);
}

type UtilisateurRow = {
  id_utilisateur?: number;
  nom?: string | null;
  prenom?: string | null;
  email?: string | null;
  telephone?: string | null;
  phone?: string | null;
  createdAt?: string | null;
  statut?: string | null;
  id_entreprise?: number | null;
  role?: { nom?: string | null } | null;
  isOnline?: boolean;
  lastSeen?: string | null;
};

/** All admins for one company — API admins[] + utilisateur[] fallback. */
export function getCompanyAdmins(enterprise: Entreprise | null): NonNullable<Entreprise['admin']>[] {
  if (!enterprise) return [];

  const companyId = enterprise.id_entreprise;
  const adminMap = new Map<string, NonNullable<Entreprise['admin']>>();

  const push = (admin: NonNullable<Entreprise['admin']> | null | undefined) => {
    if (!admin) return;
    adminMap.set(adminKey(admin), admin);
  };

  const primaryAdminId =
    enterprise.admin?.id_utilisateur ??
    enterprise.responsibleAdmin?.id_utilisateur;

  // Fallback from utilisateur[] first — then API admins[] overwrites (authoritative after save).
  const users = (enterprise.utilisateur ?? []) as UtilisateurRow[];
  for (const user of users) {
    if (user.statut === 'REJECTED') continue;
    const isPrimary =
      primaryAdminId != null && user.id_utilisateur === primaryAdminId;
    if (
      user.id_entreprise != null &&
      user.id_entreprise !== companyId &&
      !isPrimary
    ) {
      continue;
    }
    if (!isAdminRole(user.role?.nom) && !isPrimary) continue;

    const tel = user.telephone ?? user.phone ?? null;
    push({
      id_utilisateur: user.id_utilisateur,
      nom: user.nom ?? null,
      prenom: user.prenom ?? null,
      email: user.email ?? null,
      telephone: tel,
      phone: tel,
      createdAt: user.createdAt ?? null,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen ?? null,
    });
  }

  for (const admin of enterprise.admins ?? []) {
    push(admin);
  }
  push(enterprise.admin);
  push(enterprise.responsibleAdmin);

  return Array.from(adminMap.values()).sort((a, b) =>
    `${a.prenom ?? ''} ${a.nom ?? ''}`.localeCompare(
      `${b.prenom ?? ''} ${b.nom ?? ''}`,
      'fr'
    )
  );
}
