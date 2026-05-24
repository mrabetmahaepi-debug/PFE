/** Row from GET /projets/:id/members or `Projet.projectTeam`. */
export type ProjectTeamMemberRow = {
  userId: number;
  email: string;
  prenom: string;
  nom: string;
  roleProjet: string;
};

export function projectMemberDisplayLabel(m: ProjectTeamMemberRow): string {
  const name =
    `${m.prenom || ''} ${m.nom || ''}`.trim() ||
    m.email ||
    `Membre #${m.userId}`;
  const role = m.roleProjet?.trim();
  return role ? `${name} (${role})` : name;
}
