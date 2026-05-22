export const TaskStatus = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE'
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
} as const;

export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  [TaskPriority.LOW]: 'Basse',
  [TaskPriority.MEDIUM]: 'Moyenne',
  [TaskPriority.HIGH]: 'Haute',
  [TaskPriority.URGENT]: 'Urgente',
};

const LEGACY_PRIORITY_MAP: Record<string, TaskPriority> = {
  LOW: TaskPriority.LOW,
  BASSE: TaskPriority.LOW,
  MEDIUM: TaskPriority.MEDIUM,
  MOYENNE: TaskPriority.MEDIUM,
  HIGH: TaskPriority.HIGH,
  HAUTE: TaskPriority.HIGH,
  URGENT: TaskPriority.URGENT,
  URGENTE: TaskPriority.URGENT,
  CRITICAL: TaskPriority.URGENT,
  CRITIQUE: TaskPriority.URGENT,
};

export function normalizeTaskPriority(priority?: string | null): TaskPriority {
  if (!priority) return TaskPriority.MEDIUM;
  return LEGACY_PRIORITY_MAP[String(priority).trim().toUpperCase()] ?? TaskPriority.MEDIUM;
}

export interface Tache {
  id_tache: number;
  nom_t: string;
  description_t: string;
  priorite_t: TaskPriority;
  statut_t: TaskStatus | string;
  date_debut_t?: string | null;
  date_limite_t?: string;
  id_projet: number;
  id_sprint?: number | null;
  id_group?: number | null;
  id_folder?: number | null;
  id_list?: number | null;
  assigne_a?: number;
  createdAt?: string;
  updatedAt?: string;
  utilisateur?: {
    nom: string;
    prenom: string;
    email: string;
  };
  /** Rôle dans le projet (`membre_projet.role_projet`) pour l'assigné — renvoyé par l'API liste tâches. */
  assignee_project_role?: string | null;
  createur?: {
    id_utilisateur: number;
    nom: string | null;
    prenom: string | null;
    email: string | null;
  } | null;
  /** Inclus par GET /taches/mes-taches */
  projet?: {
    id_projet: number;
    nom_p?: string | null;
  } | null;
}

export interface CreateTaskData {
  nom_t: string;
  description_t: string;
  priorite_t: TaskPriority;
  statut_t: TaskStatus | string;
  id_projet: number;
  id_sprint?: number | null;
  id_group?: number | null;
  id_folder?: number | null;
  id_list?: number | null;
  assigne_a?: number | null;
  date_limite_t?: string;
}
