export interface User {
  id: string | number;
  id_utilisateur?: number;
  email: string;
  /** Display name (API may send this directly after login). */
  name?: string;
  nom?: string;
  prenom?: string;
  role?: string | { nom: string; id_role: number };
  id_entreprise?: number;
  statut?: string;
  entreprise?: {
    nom: string;
  };
  telephone?: string;
  poste?: string;
  permissions?: string[];
  lastLogin?: string;
  /** From GET /utilisateurs (team list): projects the member is linked to. */
  projects?: { id: number; name: string; roleProjet: string }[];
  /** Rôles par projet (GET /auth/me, login). */
  projectRoles?: { id_projet: number; nom_p: string; role_projet: string }[];
  lastSeen?: string;
  id_role?: number;
  /** Présent quand le backend l’expose (GET /auth/me, /me/permissions). */
  isSuperAdmin?: boolean;
  /** Presence hint from GET /utilisateurs (optional). */
  isOnline?: boolean;
  /** Profile picture path from API (e.g. /uploads/profiles/…). */
  photoUrl?: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
  role?: string;
  id_role?: number;
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
  /** Company the registering admin will manage (required for this flow). */
  entrepriseNom: string;
  companyAddress: string;
  phoneCountryCode: string;
  /** National number digits only (no country code). */
  phoneNumber: string;
}
