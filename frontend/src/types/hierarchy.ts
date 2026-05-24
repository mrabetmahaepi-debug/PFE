export type HierarchyLevel =
  | 'space'
  | 'project'
  | 'sprint'
  | 'list'
  | 'task';

/** @deprecated Legacy — no longer created in UI */
export type LegacyHierarchyLevel = 'group' | 'folder';

export interface SpacePM {
  id_space: number;
  nom: string;
  description?: string | null;
  position?: number;
  id_entreprise?: number;
}

export interface ListPM {
  id_list: number;
  nom: string;
  description?: string | null;
  position?: number;
  id_projet: number;
  id_sprint?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TreeTaskCounts {
  total: number;
}

/** Lightweight task row for sidebar tree */
export interface TreeTaskNode {
  id_tache: number;
  nom_t: string;
  statut_t?: string | null;
  id_list?: number | null;
  id_projet?: number;
  id_sprint?: number | null;
  id_parent_tache?: number | null;
  priorite_t?: string | null;
  date_limite_t?: string | null;
  subtasks?: TreeTaskNode[];
}

export interface TreeListNode extends ListPM {
  task_count?: number;
  tasks?: TreeTaskNode[];
}

export interface TreeSprintNode {
  id_sprint: number;
  nom_s: string;
  date_debut_s?: string;
  date_fin_s?: string;
  id_projet?: number | null;
  lists?: TreeListNode[];
  task_count?: number;
}

export interface TreeProjectNode {
  id_projet: number;
  nom_p: string;
  description_p?: string | null;
  id_space?: number | null;
  sprints: TreeSprintNode[];
  task_count?: number;
  /** False when resource grants filter out all sprints/lists/tasks for this user. */
  hasAccessibleContent?: boolean;
  currentUserProjectRole?: string | null;
  currentUserPermissions?: string[];
}

export interface SpaceTreeNode extends SpacePM {
  projects: TreeProjectNode[];
}

export interface SpacesHierarchyResponse {
  spaces: SpaceTreeNode[];
}

export interface ProjectTree {
  id_projet: number;
  nom_p: string;
  description_p?: string;
  id_space?: number | null;
  /** @deprecated Always empty — legacy groups removed from API */
  groups: never[];
  /** @deprecated Always empty — legacy folders removed from API */
  folders: never[];
  sprints: TreeSprintNode[];
  /** @deprecated Always empty — lists live under sprints */
  lists: never[];
  task_count: number;
  currentUserProjectRole?: string | null;
  currentUserPermissions?: string[];
}

export interface ListDetail {
  id_list: number;
  nom: string;
  description?: string | null;
  position?: number;
  id_projet: number;
  id_sprint?: number | null;
  projet?: {
    id_projet: number;
    nom_p?: string | null;
    description_p?: string | null;
    id_space?: number | null;
  } | null;
  sprint?: {
    id_sprint: number;
    nom_s?: string | null;
    date_debut_s?: string | null;
    date_fin_s?: string | null;
  } | null;
  task_count?: number;
  stats?: {
    todo: number;
    inProgress: number;
    done: number;
    total: number;
  };
}

export interface ListStatusPM {
  id_status: number;
  id_list: number;
  label: string;
  statut_key: string;
  position: number;
  is_system?: boolean;
}

export interface CreateListData {
  nom: string;
  description?: string;
  position?: number;
  id_projet: number;
  id_sprint: number;
}

export interface CreateSpaceData {
  nom: string;
  description?: string;
  position?: number;
}
