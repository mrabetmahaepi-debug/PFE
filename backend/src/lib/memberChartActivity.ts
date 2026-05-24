/** Actions counted in the member « Activité des 7 derniers jours » chart. */
export const MEMBER_CHART_ACTIONS = new Set([
  "Tâche créée",
  "Sous-tâche créée",
  "Tâche terminée",
  "Passée en EN COURS",
  "Tâche en retard",
  "Statut modifié",
  "Commentaire ajouté",
  "Sprint créé",
  "Liste créée",
  "Projet créé",
  "Nouveau projet créé",
]);

export function isMemberChartActivity(action: string | null | undefined): boolean {
  const a = String(action ?? "").trim();
  if (!a) return false;
  if (MEMBER_CHART_ACTIONS.has(a)) return true;
  return /^statut\s+modifié/i.test(a);
}
