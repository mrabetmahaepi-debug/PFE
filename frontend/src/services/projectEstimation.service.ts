/**
 * Estimation de projet (heuristique côté client).
 * Les entrées / sorties structurées permettent de brancher plus tard un modèle ML ou une API.
 */

export type EstimationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ProjectEstimationInput {
  nomProjet: string;
  description: string;
  nombreTachesPrevues: number;
  /** Effectif dédié au projet (chef + équipe), minimum 1 */
  effectif: number;
  priorite: EstimationPriority;
  /** yyyy-mm-dd */
  dateDebut?: string;
  /** yyyy-mm-dd, échéance cible optionnelle */
  dateFinCible?: string;
}

export type WorkloadLevel = 'Faible' | 'Moyenne' | 'Haute';
export type RiskLevel = 'Bas' | 'Moyen' | 'Élevé';
export type DeadlineFeasibility = 'Réaliste' | 'Serré' | 'Iréaliste' | 'Non évalué';

export interface ProjectEstimationResult {
  dureeJours: number;
  dureeLabel: string;
  charge: WorkloadLevel;
  risque: RiskLevel;
  risqueScore: number;
  faisabiliteEcheance: DeadlineFeasibility;
  joursMargeEcheance?: number;
  dateFinEstimee?: string;
  dateFinEstimeeLabel?: string;
  recommandations: string[];
  meta: {
    scopePoints: number;
    personDaysApprox: number;
    pressureIndex: number;
    resourceAdequacy: number;
  };
}

const DAY_MS = 86400000;

function parseISODateLocal(ymd: string): Date | null {
  const t = ymd?.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, d] = t.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function formatDateFr(d: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const PRIORITY_MULT: Record<EstimationPriority, number> = {
  LOW: 1.06,
  MEDIUM: 1,
  HIGH: 0.93,
  URGENT: 0.86,
};

/**
 * Calcule une estimation complète à partir des paramètres du formulaire de création.
 */
export function computeProjectEstimation(input: ProjectEstimationInput): ProjectEstimationResult {
  const tasks = clamp(Math.floor(Number(input.nombreTachesPrevues) || 0), 0, 5000);
  const head = clamp(Math.floor(Number(input.effectif) || 1), 1, 100);
  const words = input.description.trim().split(/\s+/).filter(Boolean).length;
  const nameLen = input.nomProjet.trim().length;

  const scopeFromTasks = tasks * 2.2;
  const scopeFromText = Math.min(40, words * 0.12 + nameLen * 0.06);
  const scopePoints = scopeFromTasks + scopeFromText;

  const rawPersonDays = 2 + tasks * 0.78 + words * 0.07;
  const parallel = Math.sqrt(head);
  let calendarDays = Math.ceil(rawPersonDays / Math.max(0.85, parallel));
  calendarDays = Math.max(3, Math.round(calendarDays * PRIORITY_MULT[input.priorite]));

  const loadRatio = tasks / head;
  let riskScore = 16 + Math.min(42, loadRatio * 5.5);
  if (input.priorite === 'HIGH') riskScore += 10;
  if (input.priorite === 'URGENT') riskScore += 18;
  if (head <= 2 && tasks > 12) riskScore += 10;
  if (tasks > 35 && head < 4) riskScore += 12;
  if (tasks > 80) riskScore += 8;

  let faisabiliteEcheance: DeadlineFeasibility = 'Non évalué';
  let joursMargeEcheance: number | undefined;
  let dateFinEstimee: string | undefined;
  let dateFinEstimeeLabel: string | undefined;

  const start = input.dateDebut ? parseISODateLocal(input.dateDebut) : null;
  if (start) {
    const endEst = new Date(start.getTime() + calendarDays * DAY_MS);
    dateFinEstimee = endEst.toISOString().split('T')[0];
    dateFinEstimeeLabel = formatDateFr(endEst);

    const target = input.dateFinCible ? parseISODateLocal(input.dateFinCible) : null;
    if (target) {
      joursMargeEcheance = Math.round((target.getTime() - endEst.getTime()) / DAY_MS);
      if (joursMargeEcheance >= 7) faisabiliteEcheance = 'Réaliste';
      else if (joursMargeEcheance >= 0) faisabiliteEcheance = 'Serré';
      else {
        faisabiliteEcheance = 'Iréaliste';
        riskScore += Math.min(28, Math.abs(joursMargeEcheance) * 1.8);
      }
    }
  }

  riskScore = clamp(Math.round(riskScore), 0, 100);
  const risque: RiskLevel = riskScore < 38 ? 'Bas' : riskScore < 68 ? 'Moyen' : 'Élevé';

  const workloadIndex = rawPersonDays / (calendarDays * head);
  let charge: WorkloadLevel = 'Moyenne';
  if (workloadIndex < 0.42) charge = 'Faible';
  else if (workloadIndex > 0.74) charge = 'Haute';

  const weeks = calendarDays / 7;
  let dureeLabel = `Durée estimée : ${calendarDays} jour${calendarDays > 1 ? 's' : ''}`;
  if (calendarDays >= 14) {
    dureeLabel += ` (≈ ${weeks.toFixed(1)} semaines)`;
  }

  const recommandations: string[] = [];
  if (risque === 'Élevé') {
    recommandations.push(
      'Envisagez de réduire le périmètre initial ou d’augmenter l’effectif pour absorber la charge.'
    );
  }
  if (faisabiliteEcheance === 'Iréaliste' && joursMargeEcheance != null) {
    recommandations.push(
      `L’échéance semble courte d’environ ${Math.abs(joursMargeEcheance)} jour(s) par rapport à l’estimation — négociez un décalage ou une mise en production incrémentale.`
    );
  }
  if (faisabiliteEcheance === 'Serré') {
    recommandations.push(
      'Marge faible : planifiez un tampon (revue, bugs) et priorisez le chemin critique.'
    );
  }
  if (head <= 2 && tasks > 20) {
    recommandations.push(
      'Équipe réduite pour ce volume de tâches : définissez clairement les dépendances et évitez le multitâche excessif.'
    );
  }
  if (input.priorite === 'URGENT' && charge === 'Haute') {
    recommandations.push(
      'Priorité urgente et charge élevée : validez les attendus avec les parties prenantes et figez un backlog minimal viable.'
    );
  }
  if (charge === 'Faible' && tasks > 5) {
    recommandations.push(
      'Charge modérée : vous pouvez anticiper la qualité (tests, documentation) ou prendre du recul sur le périmètre.'
    );
  }
  if (recommandations.length === 0) {
    recommandations.push(
      'Profil équilibré : suivez l’avancement hebdomadaire et ajustez l’estimation après les premiers sprints.'
    );
  }

  const pressureIndex = clamp(
    (tasks / head / 10) * 10 + (input.priorite === 'URGENT' ? 15 : input.priorite === 'HIGH' ? 8 : 0),
    0,
    100
  );
  const resourceAdequacy = clamp(100 - loadRatio * 4.5 + head * 2, 0, 100);

  return {
    dureeJours: calendarDays,
    dureeLabel,
    charge,
    risque,
    risqueScore: riskScore,
    faisabiliteEcheance,
    joursMargeEcheance,
    dateFinEstimee,
    dateFinEstimeeLabel,
    recommandations,
    meta: {
      scopePoints: Math.round(scopePoints * 10) / 10,
      personDaysApprox: Math.round(rawPersonDays * 10) / 10,
      pressureIndex: Math.round(pressureIndex),
      resourceAdequacy: Math.round(resourceAdequacy),
    },
  };
}

export const ESTIMATION_PRIORITY_LABELS: Record<EstimationPriority, string> = {
  LOW: 'Basse',
  MEDIUM: 'Moyenne',
  HIGH: 'Haute',
  URGENT: 'Urgente',
};
