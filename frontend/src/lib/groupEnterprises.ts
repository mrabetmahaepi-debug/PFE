import type { Entreprise } from '../services/entreprise.service';
import { getCompanyAdmins } from './companyAdmins';

function normalizeName(name: string | null | undefined): string {
  return String(name ?? '').trim().toLowerCase();
}

function adminKey(admin: NonNullable<Entreprise['admin']>): string {
  return String(admin.id_utilisateur ?? admin.email ?? `${admin.prenom}-${admin.nom}`);
}

/** Client-side safety net: one card per company name, merged admins. */
export function groupEnterprisesByName(enterprises: Entreprise[]): Entreprise[] {
  const grouped = new Map<string, Entreprise>();

  for (const company of enterprises) {
    const key = normalizeName(company.nom) || `id-${company.id_entreprise}`;
    const incomingAdmins = getCompanyAdmins(company);

    const existing = grouped.get(key);
    if (!existing) {
      const admins = [...incomingAdmins];
      grouped.set(key, {
        ...company,
        admins,
        admin: admins[0] ?? company.admin ?? null,
      });
      continue;
    }

    const adminMap = new Map<string, NonNullable<Entreprise['admin']>>();
    for (const a of [...getCompanyAdmins(existing), ...incomingAdmins]) {
      if (a) adminMap.set(adminKey(a), a);
    }

    const admins = Array.from(adminMap.values());
    const primary =
      existing.id_entreprise <= company.id_entreprise ? existing : company;

    grouped.set(key, {
      ...primary,
      ...existing,
      ...company,
      id_entreprise: Math.min(existing.id_entreprise, company.id_entreprise),
      nom: primary.nom ?? existing.nom ?? company.nom,
      admins,
      admin: admins[0] ?? null,
    });
  }

  return Array.from(grouped.values()).sort(
    (a, b) => b.id_entreprise - a.id_entreprise
  );
}

export function getEnterpriseAdmins(enterprise: Entreprise) {
  return getCompanyAdmins(enterprise);
}
