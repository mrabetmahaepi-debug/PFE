import type { AuthedUser } from "../middleware/permissions";
import { isSuperAdmin } from "../middleware/permissions";

export function normalizeGlobalRoleNom(role: string | null | undefined): string {
  return String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Admin d'entreprise : voit tous les projets de son entreprise. */
export function isTenantAdminUser(
  user: Pick<AuthedUser, "role"> | null | undefined
): boolean {
  const r = normalizeGlobalRoleNom(user?.role).replace(/\s/g, "");
  return r === "admin" || r === "administrateur";
}

/**
 * Rôle global « Membre » / « Member » : accès limité aux projets où une ligne
 * `membre_projet` existe pour cet utilisateur.
 */
export function isGlobalMembreUser(
  user: Pick<AuthedUser, "role"> | null | undefined
): boolean {
  const r = normalizeGlobalRoleNom(user?.role);
  return r === "membre" || r === "member";
}

/** Message JSON pour 403 lecture projet (liste filtrée / détail / arbre / hiérarchie). */
export const PROJECT_READ_FORBIDDEN_MESSAGE =
  "Vous n'avez pas accès à ce projet.";

export type ProjectReadGatePayload = {
  id_entreprise?: number | null;
  /** Seul critère pour les non-admins : présence dans `membre_projet`. */
  membre_projet?: { id_utilisateur: number | null }[];
};

/**
 * Lecture projet (liste, détail, arbre) :
 * - SuperAdmin : tout.
 * - Même entreprise obligatoire.
 * - Admin entreprise : tout le périmètre entreprise.
 * - Tout autre utilisateur : **uniquement** s'il a une ligne `membre_projet` pour ce projet.
 */
export function userCanReadProject(
  user: AuthedUser & { id: number },
  projet: ProjectReadGatePayload
): boolean {
  if (isSuperAdmin(user)) return true;

  const uid = user.id;
  const ent = user.id_entreprise;
  if (ent == null || projet.id_entreprise !== ent) return false;

  if (isTenantAdminUser(user)) return true;

  return (projet.membre_projet ?? []).some((m) => m.id_utilisateur === uid);
}
