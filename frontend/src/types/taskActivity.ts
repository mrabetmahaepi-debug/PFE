export type TaskComment = {
  id_comment: number;
  id_tache: number;
  contenu: string;
  createdAt: string;
  utilisateur: {
    id_utilisateur: number;
    nom: string | null;
    prenom: string | null;
    email: string | null;
  };
};

export type TaskHistoryEntry = {
  id_history: number;
  id_tache: number;
  field_key: string;
  old_value: string | null;
  new_value: string | null;
  createdAt: string;
  utilisateur: {
    id_utilisateur: number;
    nom: string | null;
    prenom: string | null;
    email: string | null;
  } | null;
};
