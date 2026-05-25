export const ProjectStatus = {
  PLANNING: 'PLANNING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  ON_HOLD: 'ON_HOLD',
  DELAYED: 'DELAYED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export interface Projet {
  id_projet: number;
  nom_p: string;
  description_p: string;
  date_debut: string;
  date_fin: string;
  statut_p: string;
  id_entreprise: number;
  entreprise?: {
    nom: string;
  };
  avancement?: number;
  totalTasks?: number;
  completedTasks?: number;
  inProgressTasks?: number;
  lateTasks?: number;
  todoTasks?: number;
  tachesCount?: number;
  progressPercent?: number;
  /** Derived from task stats — admin dashboard grouping. */
  dashboardBucket?: 'planning' | 'in_progress' | 'completed' | 'delayed';
  membresCount?: number;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    tache: number;
    membres: number;
  };
  membre_projet?: any[];
  affectation?: any[];
  responsable?: string;
  responsablePhotoUrl?: string | null;
  responsable_role?: string;
  chef_id?: number | null;
  chef_de_projet_id?: number | null;
  projectTeam?: {
    userId: number | null;
    email: string;
    prenom: string;
    nom: string;
    photoUrl?: string | null;
    roleProjet: string;
  }[];
  /** From GET /projets/:id — role `membre_projet.role_projet` for the current user in this project. */
  currentUserProjectRole?: string | null;
  /** From GET /projets/:id — effective project permission slugs for the current user. */
  currentUserPermissions?: string[];
}

/** Membre additionnel — le backend accepte `roleProjet`, `projectRole` ou `role` (libellé projet). */
export interface ProjetMemberInput {
  userId: number;
  role: string;
  roleProjet?: string;
  projectRole?: string;
}

export interface CreateProjetData {
  /** Nom (champ historique côté Prisma) */
  nom_p: string;
  /** Alias anglais accepté par le backend */
  name?: string;
  description_p?: string;
  description?: string;
  date_debut: string;
  date_fin: string;
  startDate?: string;
  endDate?: string;
  statut_p?: string;
  status?: string;
  chefDeProjetId?: number;
  projectManagerId?: number;
  members?: ProjetMemberInput[];
  id_space?: number;
  spaceId?: number;
}

/** Rôles proposés dans les modals projet (libellés français). */
export { PROJECT_POSTE_OPTIONS as PROJECT_MEMBER_ROLE_OPTIONS } from '../lib/projectRoleLabels';
export type { ProjectPosteOption as ProjectMemberRoleOption } from '../lib/projectRoleLabels';
