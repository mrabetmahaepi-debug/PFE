/**
 * Centralized Permission Catalog
 * --------------------------------
 * Single source of truth for every permission known to the platform.
 *
 * Design rules:
 * - Permission `name` is a stable code (UPPER_SNAKE_CASE) stored in
 *   `permission.nom`. Never rename a name; deprecate and add a new one.
 * - Categories are an APPLICATION-level grouping. They are NOT stored
 *   in the database, which keeps the schema migration-free.
 * - Adding a new permission here is purely additive: the seed will
 *   insert it without touching existing role assignments.
 * - Default role assignments are best-effort suggestions used only
 *   for system-shipped roles (SuperAdmin / Admin / Chef de Projet /
 *   Membre). Custom enterprise roles are left untouched.
 */

export type PermissionCategoryId =
  | "workspace"
  | "projects"
  | "tasks"
  | "sprints"
  | "teams"
  | "invitations"
  | "messaging"
  | "analytics"
  | "ai"
  | "billing"
  | "system";

export interface PermissionDefinition {
  name: string;
  description: string;
  category: PermissionCategoryId;
  /**
   * Marks permissions reserved to the SuperAdmin role.
   * They are still listed in the catalog so the admin UI can show them
   * as locked rows, but the permissions matrix never assigns them to
   * non-system roles.
   */
  systemOnly?: boolean;
}

export interface PermissionCategory {
  id: PermissionCategoryId;
  label: string;
  description: string;
  order: number;
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: "workspace",
    label: "Espace de travail",
    description: "Configuration et information de l'entreprise / workspace",
    order: 10,
  },
  {
    id: "projects",
    label: "Projets",
    description: "Gestion des projets, accès et cycles de vie",
    order: 20,
  },
  {
    id: "tasks",
    label: "Tâches",
    description: "Création, attribution et suivi des tâches",
    order: 30,
  },
  {
    id: "sprints",
    label: "Sprints",
    description: "Planification et exécution des sprints",
    order: 40,
  },
  {
    id: "teams",
    label: "Équipes & Rôles",
    description: "Membres, rôles et permissions",
    order: 50,
  },
  {
    id: "invitations",
    label: "Invitations",
    description: "Envoi et gestion des invitations",
    order: 60,
  },
  {
    id: "messaging",
    label: "Messagerie",
    description: "Conversations et groupes de discussion",
    order: 70,
  },
  {
    id: "analytics",
    label: "Analytique",
    description: "Tableaux de bord et statistiques",
    order: 80,
  },
  {
    id: "ai",
    label: "Prédictions IA",
    description: "Prédictions de risques, retards et insights",
    order: 90,
  },
  {
    id: "billing",
    label: "Facturation",
    description: "Abonnement, plans et facturation",
    order: 100,
  },
  {
    id: "system",
    label: "Super Administration",
    description: "Actions système réservées au SuperAdmin",
    order: 1000,
  },
];

/**
 * Canonical permissions list. Names already used in production are
 * preserved verbatim (`PROJECT_CREATE`, `TEAM_MANAGE_ROLES`, …) so the
 * upgrade is purely additive.
 */
export const PERMISSIONS: PermissionDefinition[] = [
  // --- Workspace --------------------------------------------------------
  {
    name: "ENTERPRISE_EDIT",
    description: "Modifier les informations de l'entreprise",
    category: "workspace",
  },
  {
    name: "ENTERPRISE_STATS",
    description: "Voir les statistiques de l'entreprise",
    category: "workspace",
  },
  {
    name: "WORKSPACE_VIEW",
    description: "Accéder à l'espace de travail",
    category: "workspace",
  },

  // --- Projects ---------------------------------------------------------
  {
    name: "PROJECT_VIEW_ALL",
    description: "Voir tous les projets de l'entreprise",
    category: "projects",
  },
  {
    name: "PROJECT_CREATE",
    description: "Créer de nouveaux projets",
    category: "projects",
  },
  {
    name: "PROJECT_EDIT",
    description: "Modifier les projets existants",
    category: "projects",
  },
  {
    name: "PROJECT_DELETE",
    description: "Supprimer des projets",
    category: "projects",
  },
  {
    name: "PROJECT_MANAGE_ACCESS",
    description: "Gérer les accès et membres d'un projet",
    category: "projects",
  },
  {
    name: "GROUP_VIEW",
    description: "Voir les groupes de projets",
    category: "projects",
  },
  {
    name: "GROUP_MANAGE",
    description: "Créer, modifier et supprimer les groupes de projets",
    category: "projects",
  },
  {
    name: "FOLDER_VIEW",
    description: "Voir les dossiers de projet",
    category: "projects",
  },
  {
    name: "FOLDER_MANAGE",
    description: "Créer, modifier et supprimer les dossiers de projet",
    category: "projects",
  },
  {
    name: "LIST_VIEW",
    description: "Voir les listes de travail",
    category: "projects",
  },
  {
    name: "LIST_MANAGE",
    description: "Créer, modifier et supprimer les listes de travail",
    category: "projects",
  },

  // --- Tasks ------------------------------------------------------------
  {
    name: "TASK_VIEW_ALL",
    description: "Voir toutes les tâches du projet",
    category: "tasks",
  },
  {
    name: "TASK_CREATE",
    description: "Créer des tâches",
    category: "tasks",
  },
  {
    name: "TASK_EDIT",
    description: "Modifier des tâches",
    category: "tasks",
  },
  {
    name: "TASK_DELETE",
    description: "Supprimer des tâches",
    category: "tasks",
  },
  {
    name: "TASK_ASSIGN",
    description: "Assigner des tâches aux membres",
    category: "tasks",
  },

  // --- Sprints ----------------------------------------------------------
  {
    name: "SPRINT_VIEW",
    description: "Voir les sprints",
    category: "sprints",
  },
  {
    name: "SPRINT_MANAGE",
    description: "Créer, modifier et supprimer des sprints",
    category: "sprints",
  },

  // --- Teams & Roles ----------------------------------------------------
  {
    name: "TEAM_VIEW",
    description: "Voir les membres de l'équipe",
    category: "teams",
  },
  {
    name: "TEAM_INVITE",
    description: "Inviter de nouveaux membres",
    category: "teams",
  },
  {
    name: "TEAM_MANAGE_ROLES",
    description: "Gérer les rôles et permissions",
    category: "teams",
  },
  {
    name: "TEAM_REMOVE_MEMBER",
    description: "Retirer des membres de l'équipe",
    category: "teams",
  },

  // --- Invitations ------------------------------------------------------
  {
    name: "INVITATION_VIEW",
    description: "Voir les invitations en cours",
    category: "invitations",
  },
  {
    name: "INVITATION_MANAGE",
    description: "Créer, révoquer et relancer les invitations",
    category: "invitations",
  },

  // --- Messaging --------------------------------------------------------
  {
    name: "MESSAGING_USE",
    description: "Utiliser la messagerie interne",
    category: "messaging",
  },
  {
    name: "MESSAGING_MANAGE_GROUPS",
    description: "Créer et gérer les groupes de discussion",
    category: "messaging",
  },

  // --- Analytics --------------------------------------------------------
  {
    name: "ANALYTICS_VIEW",
    description: "Consulter les tableaux de bord analytiques",
    category: "analytics",
  },

  // --- AI Predictions ---------------------------------------------------
  {
    name: "AI_PREDICTIONS_VIEW",
    description: "Voir les prédictions IA (risques, retards)",
    category: "ai",
  },
  {
    name: "AI_PREDICTIONS_MANAGE",
    description: "Configurer et déclencher les prédictions IA",
    category: "ai",
  },

  // --- Billing ----------------------------------------------------------
  {
    name: "BILLING_VIEW",
    description: "Consulter la facturation et l'abonnement",
    category: "billing",
  },
  {
    name: "BILLING_MANAGE",
    description: "Gérer les plans et moyens de paiement",
    category: "billing",
  },

  // --- System / Super Admin --------------------------------------------
  {
    name: "SYSTEM_MANAGE_ALL",
    description: "Contrôle total du système (SuperAdmin)",
    category: "system",
    systemOnly: true,
  },
  {
    name: "SYSTEM_MANAGE_ENTERPRISES",
    description: "Gérer toutes les entreprises de la plateforme",
    category: "system",
    systemOnly: true,
  },
  {
    name: "SYSTEM_APPROVE_ADMINS",
    description: "Approuver les administrateurs en attente",
    category: "system",
    systemOnly: true,
  },
  {
    name: "SYSTEM_VIEW_ACTIVITY_LOGS",
    description: "Consulter les journaux d'activité globaux",
    category: "system",
    systemOnly: true,
  },
];

/** Codes that are never assignable to tenant (non–SuperAdmin-managed) roles. */
export const SYSTEM_ONLY_PERMISSION_NAMES: ReadonlySet<string> = new Set(
  PERMISSIONS.filter((p) => p.systemOnly).map((p) => p.name)
);

const NAMES = new Set(PERMISSIONS.map((p) => p.name));

/** Returns the full canonical name list as a frozen array. */
export const ALL_PERMISSION_NAMES: readonly string[] = Object.freeze(
  PERMISSIONS.map((p) => p.name)
);

/** Returns true if a permission name is part of the canonical catalog. */
export function isKnownPermission(name: string): boolean {
  return NAMES.has(name);
}

export interface PermissionGroupDTO {
  id: PermissionCategoryId;
  label: string;
  description: string;
  permissions: Array<{
    name: string;
    description: string;
    systemOnly: boolean;
  }>;
}

/**
 * Build a UI-friendly grouped representation of the catalog.
 * `availableNames` lets callers restrict the output to permissions
 * actually present in the database (useful when serving /me/permissions).
 */
export function buildPermissionGroups(
  availableNames?: Set<string>
): PermissionGroupDTO[] {
  const byCategory = new Map<PermissionCategoryId, PermissionGroupDTO>();
  for (const cat of PERMISSION_CATEGORIES) {
    byCategory.set(cat.id, {
      id: cat.id,
      label: cat.label,
      description: cat.description,
      permissions: [],
    });
  }

  for (const perm of PERMISSIONS) {
    if (availableNames && !availableNames.has(perm.name)) continue;
    byCategory.get(perm.category)?.permissions.push({
      name: perm.name,
      description: perm.description,
      systemOnly: !!perm.systemOnly,
    });
  }

  // Drop empty groups, keep canonical order.
  return PERMISSION_CATEGORIES.filter((c) => {
    const g = byCategory.get(c.id);
    return g && g.permissions.length > 0;
  }).map((c) => byCategory.get(c.id) as PermissionGroupDTO);
}

/**
 * Default permission sets for the system-shipped roles.
 * Used by the seed only — never applied to custom enterprise roles.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  SuperAdmin: PERMISSIONS.map((p) => p.name),
  Admin: PERMISSIONS.filter((p) => !p.systemOnly).map((p) => p.name),
  // Membre — espace + tâches / équipe ; les projets listés viennent uniquement
  // de `membre_projet` (voir projetController + routes `WORKSPACE_VIEW`).
  Membre: [
    "WORKSPACE_VIEW",
    "FOLDER_VIEW",
    "LIST_VIEW",
    "TASK_VIEW_ALL",
    "TASK_EDIT",
    "TEAM_VIEW",
    "MESSAGING_USE",
  ],
};
