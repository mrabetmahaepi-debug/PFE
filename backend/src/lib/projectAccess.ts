import type { AuthedUser } from "../middleware/permissions";

import { isSuperAdmin } from "../middleware/permissions";

import { isProjectAccessDenied } from "./userAccessGrants";



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

 * Rôle global « Membre » / « Member » : accès limité aux projets assignés.

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

  id_projet?: number;

  chef_de_projet_id?: number | null;

  /** Présence / rôle dans l'équipe projet. */

  membre_projet?: {

    id_utilisateur: number | null;

    role_projet?: string | null;

  }[];

};



/** Prisma `where` fragment — projects visible to Utilisateur (member or chef responsable). */
export function buildAssignedProjectVisibilityWhere(
  userId: number,
  _poste?: string | null | undefined
): Record<string, unknown> {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid < 1) {
    return { id_projet: -1 };
  }

  return {
    OR: [
      { chef_de_projet_id: uid },
      { membre_projet: { some: { id_utilisateur: uid } } },
    ],
  };
}



/**

 * Lecture projet (liste, détail, arbre) :

 * - SuperAdmin : tout.

 * - Même entreprise obligatoire.

 * - Admin entreprise : tout le périmètre entreprise.

 * - Chef de projet : responsable OU membre équipe (rôle chef ou toute assignation).

 * - Autres : ligne `membre_projet` pour ce projet.

 */

export function userCanReadProject(

  user: AuthedUser & { id: number; poste?: string | null },

  projet: ProjectReadGatePayload

): boolean {

  if (isSuperAdmin(user)) return true;



  const uid = user.id;

  const ent = user.id_entreprise;

  if (ent == null || projet.id_entreprise !== ent) return false;



  if (isTenantAdminUser(user)) return true;



  if (projet.chef_de_projet_id != null && Number(projet.chef_de_projet_id) === uid) {

    return true;

  }



  const membership = (projet.membre_projet ?? []).find(

    (m) => m.id_utilisateur === uid

  );

  if (!membership) return false;

  return true;
}



/** Async gate that also respects explicit admin DENY grants on projects. */

export async function userCanReadProjectAsync(

  user: AuthedUser & { id: number },

  projet: ProjectReadGatePayload & { id_projet?: number }

): Promise<boolean> {

  if (!userCanReadProject(user, projet)) return false;

  const projectId = projet.id_projet;

  if (projectId == null || !Number.isFinite(projectId)) return true;

  if (isTenantAdminUser(user) || isSuperAdmin(user)) return true;

  return !(await isProjectAccessDenied(user.id, projectId));

}

