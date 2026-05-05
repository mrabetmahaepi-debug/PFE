export const ProjectStatus = {
  PLANNING: 'PLANNING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  ON_HOLD: 'ON_HOLD'
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
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    tache: number;
    membres: number;
  };
  membre_projet?: any[];
  affectation?: any[];
}

export interface CreateProjetData {
  nom_p: string;
  description_p: string;
  date_debut: string;
  date_fin: string;
  statut_p?: string;
}
