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
  CRITICAL: 'CRITICAL'
} as const;

export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export interface Tache {
  id_tache: number;
  nom_t: string;
  description_t: string;
  priorite_t: TaskPriority;
  statut_t: TaskStatus;
  date_limite_t?: string;
  id_projet: number;
  id_sprint?: number;
  assigne_a?: number;
  createdAt?: string;
  updatedAt?: string;
  utilisateur?: {
    nom: string;
    prenom: string;
    email: string;
  };
}

export interface CreateTaskData {
  nom_t: string;
  description_t: string;
  priorite_t: TaskPriority;
  statut_t: TaskStatus;
  id_projet: number;
  id_sprint?: number;
  assigne_a?: number;
  date_limite_t?: string;
}
