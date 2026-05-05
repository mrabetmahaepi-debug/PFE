export interface User {
  id: string | number;
  id_utilisateur?: number;
  email: string;
  nom?: string;
  prenom?: string;
  role?: string | { nom: string; id_role: number };
  id_entreprise?: number;
  statut?: string;
  entreprise?: {
    nom: string;
  };
  permissions?: string[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  nom: string;
  prenom: string;
  entrepriseNom?: string;
}
