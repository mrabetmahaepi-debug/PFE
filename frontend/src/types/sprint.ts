export interface Sprint {
  id_sprint: number;
  nom_s: string;
  date_debut_s: string;
  date_fin_s: string;
  id_projet: number;
  id_group?: number | null;
  id_folder?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSprintData {
  nom_s: string;
  date_debut_s: string;
  date_fin_s: string;
  id_projet: number;
  id_group?: number | null;
  id_folder?: number | null;
}
