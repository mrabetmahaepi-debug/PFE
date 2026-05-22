import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Loader2,
  Briefcase,
  ListTodo,
  CheckSquare,
  CheckCircle2,
  Users,
  CircleDashed,
  CircleDotDashed,
  Inbox,
  Calendar,
  LayoutGrid,
  List as ListIcon,
  MoreHorizontal,
  Trash2,
  Globe,
  Settings,
  Filter,
} from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  appPaths,
  buildListPath,
  findListInSpaces,
  parseWorkspacePath,
} from '../lib/workspaceRoutes';
import { WORKSPACE_REFRESH_EVENT } from '../lib/workspaceEvents';
import { projectService } from '../services/project.service';
import { hierarchyService } from '../services/hierarchy.service';
import { taskService } from '../services/task.service';
import { useAuth } from '../hooks/useAuth';
import { usePermission } from '../hooks/usePermission';
import { getRoleKey } from '../lib/permissions';
import type { Projet } from '../types/project';
import type {
  ProjectTree,
  SpaceTreeNode,
  TreeListNode,
  TreeSprintNode,
  TreeTaskNode,
} from '../types/hierarchy';
import { spaceService } from '../services/space.service';
import type {
  SidebarTaskMenuContext,
  SpaceSelection,
} from '../components/SpaceHierarchyTree';
import type { TreeTaskMenuAction } from '../components/TreeTaskContextMenu';
import type { ListPageTab } from '../components/ListPageView';
import TaskDeleteConfirmModal from '../components/TaskDeleteConfirmModal';
import {
  TaskStatus,
  type Tache,
} from '../types/task';
import CreateHierarchyItemModal, {
  type HierarchyParentContext,
  type CreatedHierarchyItem,
} from '../components/CreateHierarchyItemModal';
import KanbanBoard, {
  isTaskOverdue,
  type BoardColumnId,
} from '../components/KanbanBoard';
import WorkspaceTaskDetailPanel from '../components/WorkspaceTaskDetailPanel';
import ListPageView from '../components/ListPageView';
import './Workspace.css';

type ProjectManagerDisplay = {
  name: string;
  email: string;
};

type ProjectTeamRow = {
  userId: number;
  name: string;
  email: string;
  roleProjet: string;
};

function memberDisplayName(prenom?: string, nom?: string, email?: string): string {
  const n = `${prenom || ''} ${nom || ''}`.trim();
  return n || email || 'Membre';
}

function resolveProjectManager(detail: Projet | null): ProjectManagerDisplay | null {
  if (!detail) return null;
  const chefNested = (
    detail as Projet & {
      chef_de_projet?: { prenom?: string; nom?: string; email?: string };
    }
  ).chef_de_projet;
  if (chefNested && (chefNested.email || chefNested.prenom || chefNested.nom)) {
    return {
      name: memberDisplayName(chefNested.prenom, chefNested.nom, chefNested.email),
      email: chefNested.email || '',
    };
  }
  const team = normalizeProjectTeamMembers(detail);
  const chefRow = team.find((m) => isChefDeProjetLabel(m.roleProjet));
  if (chefRow) {
    return {
      name: memberDisplayName(chefRow.prenom, chefRow.nom, chefRow.email),
      email: chefRow.email || '',
    };
  }
  if (detail.responsable && detail.responsable !== 'Non assigné') {
    return { name: detail.responsable, email: '' };
  }
  return null;
}

function normalizeProjectTeamMembers(
  detail: Projet | null
): NonNullable<Projet['projectTeam']> {
  if (!detail) return [];
  if (detail.projectTeam && detail.projectTeam.length > 0) {
    return detail.projectTeam;
  }
  const raw = (
    detail as Projet & {
      membre_projet?: {
        id_utilisateur?: number | null;
        role_projet?: string | null;
        utilisateur?: { prenom?: string; nom?: string; email?: string };
      }[];
    }
  ).membre_projet;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m.id_utilisateur != null && m.utilisateur)
    .map((m) => ({
      userId: Number(m.id_utilisateur),
      email: m.utilisateur?.email ?? '',
      prenom: m.utilisateur?.prenom ?? '',
      nom: m.utilisateur?.nom ?? '',
      roleProjet: m.role_projet?.trim() || 'Membre',
    }));
}

function buildProjectTeamRows(
  detail: Projet | null,
  taskFallback?: Tache[]
): ProjectTeamRow[] {
  const team = normalizeProjectTeamMembers(detail);
  const rows = team
    .filter((m) => m.userId != null && Number(m.userId) > 0)
    .map((m) => ({
      userId: Number(m.userId),
      name: memberDisplayName(m.prenom, m.nom, m.email),
      email: m.email || '',
      roleProjet: m.roleProjet?.trim() || 'Membre',
    }));
  const chefId = detail?.chef_de_projet_id ?? detail?.chef_id;
  const pm = resolveProjectManager(detail);
  if (
    pm &&
    chefId != null &&
    Number(chefId) > 0 &&
    !rows.some((r) => r.userId === Number(chefId))
  ) {
    rows.unshift({
      userId: Number(chefId),
      name: pm.name,
      email: pm.email,
      roleProjet: 'Chef de projet',
    });
  }
  if (rows.length === 0 && taskFallback?.length) {
    const seen = new Map<number, ProjectTeamRow>();
    for (const t of taskFallback) {
      if (!t.assigne_a || !t.utilisateur || seen.has(t.assigne_a)) continue;
      seen.set(t.assigne_a, {
        userId: t.assigne_a,
        name: memberDisplayName(
          t.utilisateur.prenom,
          t.utilisateur.nom,
          t.utilisateur.email
        ),
        email: t.utilisateur.email || '',
        roleProjet: 'Membre',
      });
    }
    rows.push(...seen.values());
  }

  return rows.sort((a, b) => {
    if (isChefDeProjetLabel(a.roleProjet)) return -1;
    if (isChefDeProjetLabel(b.roleProjet)) return 1;
    return a.name.localeCompare(b.name, 'fr');
  });
}

interface ModalState {
  open: boolean;
  level: 'space' | 'list' | 'task' | 'sprint';
  parent: HierarchyParentContext | null;
  defaultStatus?: TaskStatus;
  defaultStatutKey?: string;
}

function isChefDeProjetLabel(role: string | null | undefined): boolean {
  if (!role?.trim()) return false;
  const n = role
    .normalize('NFD')
    .replace(/\u0300-\u036f/g, '')
    .toLowerCase();
  return n.includes('chef') && n.includes('projet');
}

function flattenTreeSprints(t: ProjectTree): TreeSprintNode[] {
  return t.sprints || [];
}

type ViewMode = 'list' | 'board';
type StatusFilter = 'all' | TaskStatus;
type AssigneeFilter = 'all' | number;
type DueFilter = 'all' | 'today' | 'week' | 'overdue' | 'none';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const pastDueIso = () => {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  y.setHours(12, 0, 0, 0);
  return y.toISOString();
};

const futureDueIso = () => {
  const n = new Date();
  n.setDate(n.getDate() + 7);
  n.setHours(12, 0, 0, 0);
  return n.toISOString();
};

const initials = (label?: string) => {
  if (!label) return '?';
  const parts = label.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatDate = (raw?: string | null) => {
  if (!raw) return null;
  try {
    return new Date(raw).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return null;
  }
};

const Workspace: React.FC = () => {
  const { can, isSuperAdmin } = usePermission();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [spaces, setSpaces] = useState<SpaceTreeNode[]>([]);
  const [treeSelection, setTreeSelection] = useState<SpaceSelection | null>(
    null
  );
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [listPageTab, setListPageTab] = useState<ListPageTab>('list');
  const [listPageRefreshKey, setListPageRefreshKey] = useState(0);
  const [pendingDeleteTask, setPendingDeleteTask] = useState<Tache | null>(null);
  const [deletingTask, setDeletingTask] = useState(false);
  const [detailTaskSnapshot, setDetailTaskSnapshot] = useState<Tache | null>(
    null
  );
  const [tree, setTree] = useState<ProjectTree | null>(null);
  const [tasks, setTasks] = useState<Tache[]>([]);
  const [search, setSearch] = useState('');
  const [taskFilter, setTaskFilter] = useState<StatusFilter>('all');
  const [view, setView] = useState<ViewMode>('list');
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTree, setLoadingTree] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [highlightTaskId, setHighlightTaskId] = useState<number | null>(null);
  const [openMenuTaskId, setOpenMenuTaskId] = useState<number | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeProjectDetail, setActiveProjectDetail] = useState<Projet | null>(null);
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);
  const [loadingProjectDetail, setLoadingProjectDetail] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [assigneeFilter, setAssigneeFilter] =
    useState<AssigneeFilter>('all');
  const [dueFilter, setDueFilter] = useState<DueFilter>('all');
  const [modal, setModal] = useState<ModalState>({
    open: false,
    level: 'task',
    parent: null,
  });
  const [sprintScope, setSprintScope] = useState<'all' | number>('all');
  const [treeExpanded, setTreeExpanded] = useState<Set<string>>(() => new Set());

  const canCreateTasksWorkspace = useMemo(() => {
    const pp = Array.isArray(tree?.currentUserPermissions)
      ? tree.currentUserPermissions
      : [];
    return (
      isSuperAdmin ||
      getRoleKey(user) === 'ADMIN' ||
      pp.includes('create_tasks')
    );
  }, [isSuperAdmin, user, tree]);

  const canManageProject = useMemo(() => {
    const pp = Array.isArray(tree?.currentUserPermissions)
      ? tree.currentUserPermissions
      : [];
    return (
      isSuperAdmin ||
      getRoleKey(user) === 'ADMIN' ||
      isChefDeProjetLabel(tree?.currentUserProjectRole) ||
      pp.includes('create_tasks')
    );
  }, [isSuperAdmin, user, tree]);

  const canCreateSprint = useMemo(() => {
    const pp = Array.isArray(tree?.currentUserPermissions)
      ? tree.currentUserPermissions
      : [];
    return (
      isSuperAdmin ||
      getRoleKey(user) === 'ADMIN' ||
      pp.includes('create_sprints') ||
      pp.includes('manage_sprints')
    );
  }, [isSuperAdmin, user, tree]);

  const canCreateList = can('LIST_MANAGE') || isSuperAdmin;
  const canManageList = can('LIST_MANAGE') || isSuperAdmin;
  const canDeleteTask = can('TASK_DELETE') || isSuperAdmin;
  const canEditTask = can('TASK_EDIT') || isSuperAdmin;

  const hydrateTreeFromSpaces = (
    projectId: number,
    source: SpaceTreeNode[]
  ): ProjectTree | null => {
    const project = source
      .flatMap((s) => s.projects || [])
      .find((p) => p.id_projet === projectId);
    if (!project) return null;
    return {
      id_projet: project.id_projet,
      nom_p: project.nom_p,
      description_p: project.description_p,
      id_space: project.id_space,
      groups: [],
      folders: [],
      sprints: project.sprints || [],
      lists: [],
      task_count: project.task_count ?? 0,
      currentUserProjectRole: project.currentUserProjectRole,
      currentUserPermissions: project.currentUserPermissions,
    };
  };

  const fetchSpacesHierarchy = async (selectProjectId?: number) => {
    setLoadingProjects(true);
    setError('');
    try {
      const { spaces: loaded } = await spaceService.getHierarchy();
      const list = Array.isArray(loaded) ? loaded : [];
      setSpaces(list);

      const allProjects = list.flatMap((s) => s.projects || []);
      const pathIds = parseWorkspacePath(location.pathname);
      const legacyProject = searchParams.get('project');
      const urlProjectId =
        pathIds.folderId ??
        (legacyProject && Number.isFinite(Number(legacyProject))
          ? Number(legacyProject)
          : null);
      const targetId =
        selectProjectId ??
        urlProjectId ??
        activeProjectId ??
        allProjects[0]?.id_projet ??
        null;

      if (targetId) {
        setActiveProjectId(targetId);
        const hydrated = hydrateTreeFromSpaces(targetId, list);
        if (hydrated) setTree(hydrated);
        if (!selectProjectId && !activeListId) {
          setActiveListId(null);
        }
      } else {
        setActiveProjectId(null);
        setTree(null);
        setTasks([]);
      }
    } catch (err: any) {
      setSpaces([]);
      setActiveProjectId(null);
      setTree(null);
      setTasks([]);
      const status = err?.response?.status;
      const msg =
        status === 403
          ? "Vous n'avez pas accès à cette ressource."
          : err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            'Impossible de charger les espaces';
      setError(typeof msg === 'string' ? msg : 'Impossible de charger les espaces');
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchTree = async (projectId: number) => {
    setLoadingTree(true);
    setError('');
    try {
      const t = await projectService.getTree(projectId);
      setTree(t);
      return t;
    } catch (err: any) {
      const status = err?.response?.status;
      const msg =
        status === 403
          ? "Vous n'avez pas accès à ce projet."
          : err?.response?.data?.message ||
            err?.response?.data?.error ||
            'Impossible de charger le projet';
      setError(typeof msg === 'string' ? msg : 'Impossible de charger le projet');
      setTree(null);
      return null;
    } finally {
      setLoadingTree(false);
    }
  };

  const fetchTasks = async (projectId: number) => {
    try {
      const data = await taskService.getByProject(String(projectId));
      setTasks(Array.isArray(data) ? data : []);
      return Array.isArray(data) ? data : [];
    } catch {
      setTasks([]);
      return [];
    }
  };

  /** Redirect legacy /spaces?space=&project=&list= URLs to path-based routes. */
  useEffect(() => {
    if (!location.pathname.startsWith('/spaces')) return;
    const pathIds = parseWorkspacePath(location.pathname);
    if (pathIds.spaceId != null) return;

    const spaceQ = searchParams.get('space');
    const projectQ = searchParams.get('project');
    const listQ = searchParams.get('list');
    const taskQ = searchParams.get('task');
    if (!spaceQ && !projectQ && !listQ && !taskQ) return;

    if (taskQ && Number.isFinite(Number(taskQ))) {
      navigate(appPaths.task(taskQ), { replace: true });
      return;
    }

    const spaceId = spaceQ && Number.isFinite(Number(spaceQ)) ? Number(spaceQ) : null;
    const folderId =
      projectQ && Number.isFinite(Number(projectQ)) ? Number(projectQ) : null;
    const listId = listQ && Number.isFinite(Number(listQ)) ? Number(listQ) : null;

    let path = appPaths.spaces;
    if (spaceId != null && folderId != null && listId != null) {
      const found = findListInSpaces(spaces, listId);
      path = buildListPath(
        spaceId,
        folderId,
        listId,
        found?.sprintId ?? found?.list.id_sprint ?? null
      );
    } else if (spaceId != null && folderId != null) {
      path = appPaths.folder(spaceId, folderId);
    } else if (spaceId != null) {
      path = appPaths.space(spaceId);
    }

    const view = searchParams.get('view');
    const create = searchParams.get('create');
    const next = new URLSearchParams();
    if (view) next.set('view', view);
    if (create) next.set('create', create);
    const qs = next.toString();
    navigate(qs ? `${path}?${qs}` : path, { replace: true });
  }, [location.pathname, searchParams, navigate, spaces]);

  /** List pages use dedicated /lists/:listId route. */
  useEffect(() => {
    const pathIds = parseWorkspacePath(location.pathname);
    if (pathIds.listId != null) {
      const qs = location.search;
      const target = appPaths.listView(pathIds.listId);
      navigate(qs ? `${target}${qs}` : target, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    void fetchSpacesHierarchy();
  }, []);

  useEffect(() => {
    if (loadingProjects || spaces.length === 0) return;

    const pathIds = parseWorkspacePath(location.pathname);
    const spaceParam = searchParams.get('space');
    const projectParam = searchParams.get('project');
    const listParam = searchParams.get('list');
    const viewParam = searchParams.get('view');
    const createParam = searchParams.get('create');

    if (createParam === 'space') {
      setModal({ open: true, level: 'space', parent: null });
    }

    const projectId =
      pathIds.folderId ??
      (projectParam && Number.isFinite(Number(projectParam))
        ? Number(projectParam)
        : null);
    const listId =
      pathIds.listId ??
      (listParam && Number.isFinite(Number(listParam))
        ? Number(listParam)
        : null);
    const spaceId =
      pathIds.spaceId ??
      (spaceParam && Number.isFinite(Number(spaceParam))
        ? Number(spaceParam)
        : null);

    if (projectId) {
      const project = spaces
        .flatMap((s) => s.projects || [])
        .find((p) => p.id_projet === projectId);
      if (!project) return;

      setActiveProjectId(projectId);
      const hydrated = hydrateTreeFromSpaces(projectId, spaces);
      if (hydrated) setTree(hydrated);

      setTreeExpanded((prev) => {
        const next = new Set(prev);
        next.add(`project:${projectId}`);
        if (spaceId) next.add(`space:${spaceId}`);
        else if (project.id_space) next.add(`space:${project.id_space}`);
        return next;
      });

      if (listId) {
        setActiveListId(listId);
        setListPageTab('list');
        const listNode = (project.sprints || [])
          .flatMap((s) => s.lists || [])
          .find((l) => l.id_list === listId);
        setTreeSelection({
          level: 'list',
          id_space: spaceId ?? project.id_space ?? undefined,
          id_projet: projectId,
          id_list: listId,
          label: listNode?.nom ?? 'Liste',
        });
        if (listNode?.id_sprint) {
          setTreeExpanded((prev) => {
            const next = new Set(prev);
            next.add(`sprint:${listNode.id_sprint}`);
            next.add(`list:${listId}`);
            return next;
          });
        }
      } else {
        setActiveListId(null);
        setTreeSelection({
          level: 'project',
          id_space: spaceId ?? project.id_space ?? undefined,
          id_projet: projectId,
          label: project.nom_p,
        });
      }
      return;
    }

    if (spaceId) {
      const space = spaces.find((s) => s.id_space === spaceId);
      if (!space) return;
      setActiveListId(null);
      setTreeSelection({
        level: 'space',
        id_space: spaceId,
        label: space.nom,
      });
      setTreeExpanded((prev) => {
        const next = new Set(prev);
        next.add(`space:${spaceId}`);
        return next;
      });
    }
  }, [loadingProjects, spaces, searchParams, location.pathname]);

  useEffect(() => {
    if (activeProjectId) {
      fetchTree(activeProjectId);
      fetchTasks(activeProjectId);
    } else {
      setTree(null);
      setTasks([]);
    }
  }, [activeProjectId]);

  useEffect(() => {
    const onHierarchyRefresh = () => {
      if (!activeProjectId) return;
      void fetchSpacesHierarchy(activeProjectId);
      void fetchTree(activeProjectId);
      void fetchTasks(activeProjectId);
      setListPageRefreshKey((k) => k + 1);
    };
    window.addEventListener(WORKSPACE_REFRESH_EVENT, onHierarchyRefresh);
    return () =>
      window.removeEventListener(WORKSPACE_REFRESH_EVENT, onHierarchyRefresh);
  }, [activeProjectId]);

  useEffect(() => {
    setSprintScope('all');
  }, [activeProjectId]);

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(''), 2400);
    return () => clearTimeout(t);
  }, [successMessage]);

  useEffect(() => {
    if (!errorMessage) return;
    const t = setTimeout(() => setErrorMessage(''), 4000);
    return () => clearTimeout(t);
  }, [errorMessage]);

  const showErrorToast = (message: string) => {
    setErrorMessage(message);
    console.error('[Workspace]', message);
  };

  useEffect(() => {
    if (highlightTaskId === null) return;
    const t = setTimeout(() => setHighlightTaskId(null), 1500);
    return () => clearTimeout(t);
  }, [highlightTaskId]);

  // Close any open task action menu on outside click.
  useEffect(() => {
    if (openMenuTaskId === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.task-row-menu') && !target.closest('.task-row-more')) {
        setOpenMenuTaskId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuTaskId]);

  const projectMenuRef = useRef<HTMLDivElement>(null);
  const teamBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!activeProjectId) {
      setActiveProjectDetail(null);
      setLoadingProjectDetail(false);
      return;
    }
    let cancelled = false;
    setLoadingProjectDetail(true);
    void projectService
      .getById(activeProjectId)
      .then((p) => {
        if (!cancelled) setActiveProjectDetail(p);
      })
      .catch(() => {
        if (!cancelled) setActiveProjectDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingProjectDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  useEffect(() => {
    setTeamPanelOpen(false);
  }, [activeProjectId]);

  useEffect(() => {
    if (!projectMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        projectMenuRef.current &&
        !projectMenuRef.current.contains(e.target as Node)
      ) {
        setProjectMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [projectMenuOpen]);

  const allProjects = useMemo(
    () =>
      spaces.flatMap((s) =>
        (s.projects || []).map((p) => ({
          id_projet: p.id_projet,
          nom_p: p.nom_p,
        }))
      ),
    [spaces]
  );

  const hasAnyProject = allProjects.length > 0;

  const filteredSpaces = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return spaces;
    return spaces
      .map((space) => ({
        ...space,
        projects: (space.projects || []).filter((p) => {
          const matchProject = (p.nom_p || '').toLowerCase().includes(q);
          const matchChild = (p.sprints || []).some(
            (s) =>
              (s.nom_s || '').toLowerCase().includes(q) ||
              (s.lists || []).some((l) =>
                (l.nom || '').toLowerCase().includes(q)
              )
          );
          return (
            matchProject ||
            matchChild ||
            (space.nom || '').toLowerCase().includes(q)
          );
        }),
      }))
      .filter(
        (s) =>
          (s.projects?.length ?? 0) > 0 ||
          (s.nom || '').toLowerCase().includes(q)
      );
  }, [spaces, search]);

  const allLists = useMemo<TreeListNode[]>(() => {
    if (!tree) return [];
    const seen = new Set<number>();
    const merged: TreeListNode[] = [];
    for (const s of tree.sprints || []) {
      for (const l of s.lists || []) {
        if (!seen.has(l.id_list)) {
          seen.add(l.id_list);
          merged.push(l);
        }
      }
    }
    return merged;
  }, [tree]);

  const flatTreeSprints = useMemo(
    () => (tree ? flattenTreeSprints(tree) : []),
    [tree]
  );

  const activeSprint = useMemo(() => {
    if (sprintScope === 'all') return null;
    const sid = Number(sprintScope);
    return flatTreeSprints.find((s) => s.id_sprint === sid) ?? null;
  }, [sprintScope, flatTreeSprints]);

  const visibleLists = useMemo(() => {
    if (sprintScope === 'all') return allLists;
    const sid = Number(sprintScope);
    return allLists.filter((l) => Number(l.id_sprint ?? 0) === sid);
  }, [allLists, sprintScope]);

  const listLookup = useMemo(() => {
    const map: Record<number, string> = {};
    for (const l of allLists) map[l.id_list] = l.nom;
    return map;
  }, [allLists]);

  const workspaceFilteredTasks = useMemo(() => {
    let list = tasks;
    if (taskFilter !== 'all') {
      list = list.filter((t) => t.statut_t === taskFilter);
    }
    if (assigneeFilter !== 'all') {
      list = list.filter((t) => t.assigne_a === assigneeFilter);
    }
    if (dueFilter !== 'all') {
      const today = startOfToday();
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);
      weekEnd.setHours(23, 59, 59, 999);
      list = list.filter((t) => {
        if (!t.date_limite_t) return dueFilter === 'none';
        const d = new Date(t.date_limite_t);
        d.setHours(0, 0, 0, 0);
        const tt = today.getTime();
        const dt = d.getTime();
        if (dueFilter === 'overdue') {
          return dt < tt && t.statut_t !== TaskStatus.DONE;
        }
        if (dueFilter === 'today') return dt === tt;
        if (dueFilter === 'week') {
          return dt >= tt && dt <= weekEnd.getTime();
        }
        if (dueFilter === 'none') return false;
        return true;
      });
    }
    if (sprintScope !== 'all') {
      const sid = Number(sprintScope);
      list = list.filter((t) => Number(t.id_sprint ?? 0) === sid);
    }
    return list;
  }, [
    tasks,
    taskFilter,
    assigneeFilter,
    dueFilter,
    sprintScope,
  ]);

  const assigneeOptions = useMemo(() => {
    const m = new Map<number, string>();
    for (const t of tasks) {
      if (t.assigne_a && t.utilisateur) {
        const label =
          `${t.utilisateur.prenom || ''} ${t.utilisateur.nom || ''}`.trim() ||
          t.utilisateur.email;
        m.set(t.assigne_a, label);
      }
    }
    return Array.from(m.entries());
  }, [tasks]);

  const detailTask = useMemo(() => {
    if (detailTaskSnapshot?.id_tache === detailTaskId) return detailTaskSnapshot;
    if (!detailTaskId) return null;
    return tasks.find((t) => t.id_tache === detailTaskId) ?? detailTaskSnapshot;
  }, [tasks, detailTaskId, detailTaskSnapshot]);

  const progressPercent = useMemo(() => {
    if (tasks.length === 0) return 0;
    const done = tasks.filter((t) => t.statut_t === TaskStatus.DONE).length;
    return Math.round((done / tasks.length) * 100);
  }, [tasks]);

  const tasksByList = useMemo(() => {
    const map = new Map<number | 'inbox', Tache[]>();
    map.set('inbox', []);
    for (const list of allLists) map.set(list.id_list, []);
    for (const t of workspaceFilteredTasks) {
      const id = t.id_list as number | null | undefined;
      if (id && map.has(id)) {
        map.get(id)!.push(t);
        continue;
      }
      if (t.id_sprint) {
        const fallback = allLists.find(
          (l) =>
            l.id_sprint === t.id_sprint &&
            (l.nom === 'Liste par défaut' || l.nom === 'Général')
        );
        if (fallback && map.has(fallback.id_list)) {
          map.get(fallback.id_list)!.push(t);
          continue;
        }
      }
      map.get('inbox')!.push(t);
    }
    return map;
  }, [workspaceFilteredTasks, allLists]);

  const counts = useMemo(() => {
    let todo = 0;
    let inProgress = 0;
    let done = 0;
    for (const t of workspaceFilteredTasks) {
      if (t.statut_t === TaskStatus.TODO) todo++;
      else if (t.statut_t === TaskStatus.IN_PROGRESS) inProgress++;
      else if (t.statut_t === TaskStatus.DONE) done++;
    }
    return { todo, inProgress, done, total: workspaceFilteredTasks.length };
  }, [workspaceFilteredTasks]);

  // Derive a unique set of project members from task assignees so we can
  // render an avatar stack on the header without an extra API call.
  const projectMembers = useMemo(() => {
    const team = activeProjectDetail?.projectTeam ?? [];
    if (team.length > 0) {
      return team
        .filter((m) => m.userId != null)
        .map((m) => ({
          id: Number(m.userId),
          label: memberDisplayName(m.prenom, m.nom, m.email),
        }));
    }
    const seen = new Map<number, { id: number; label: string }>();
    for (const t of tasks) {
      if (t.assigne_a && t.utilisateur && !seen.has(t.assigne_a)) {
        const label = `${t.utilisateur.prenom || ''} ${t.utilisateur.nom || ''}`.trim();
        seen.set(t.assigne_a, { id: t.assigne_a, label });
      }
    }
    return Array.from(seen.values());
  }, [tasks, activeProjectDetail]);

  const projectManager = useMemo(
    () => resolveProjectManager(activeProjectDetail),
    [activeProjectDetail]
  );

  const projectTeamRows = useMemo(
    () => buildProjectTeamRows(activeProjectDetail, tasks),
    [activeProjectDetail, tasks]
  );

  const { projectTeamChef, projectTeamOthers } = useMemo(() => {
    const chefs = projectTeamRows.filter((m) => isChefDeProjetLabel(m.roleProjet));
    const chef = chefs[0] ?? null;
    const others = projectTeamRows.filter(
      (m) => !isChefDeProjetLabel(m.roleProjet) && m.userId !== chef?.userId
    );
    return { projectTeamChef: chef, projectTeamOthers: others };
  }, [projectTeamRows]);

  const refreshProjectDetail = async (projectId: number) => {
    setLoadingProjectDetail(true);
    try {
      const p = await projectService.getById(projectId);
      setActiveProjectDetail(p);
    } catch {
      setActiveProjectDetail(null);
    } finally {
      setLoadingProjectDetail(false);
    }
  };

  const toggleTeamPanel = () => {
    setTeamPanelOpen((open) => {
      const next = !open;
      if (next && activeProjectId != null) {
        void refreshProjectDetail(activeProjectId);
      }
      return next;
    });
  };

  const LIST_REQUIRED_MSG =
    'Veuillez sélectionner une liste avant de créer une tâche';

  const buildTaskParent = (
    parent: HierarchyParentContext | null
  ): HierarchyParentContext | null => {
    const id_projet =
      parent?.id_projet && parent.id_projet > 0
        ? parent.id_projet
        : activeProjectId ?? treeSelection?.id_projet ?? 0;
    const id_list =
      parent?.id_list ?? activeListId ?? treeSelection?.id_list ?? null;
    const id_sprint =
      parent?.id_sprint ?? treeSelection?.id_sprint ?? null;
    let id_space = parent?.id_space ?? treeSelection?.id_space ?? null;
    if (!id_space && id_projet > 0) {
      for (const space of spaces) {
        if (
          (space.projects || []).some((p) => p.id_projet === id_projet)
        ) {
          id_space = space.id_space;
          break;
        }
      }
    }
    if (!id_projet || id_projet < 1) return null;
    return { id_projet, id_list, id_sprint, id_space };
  };

  const openCreate = (
    level: ModalState['level'],
    parent: HierarchyParentContext | null,
    defaultStatusOrStatutKey?: TaskStatus | string
  ) => {
    const defaultStatutKey =
      typeof defaultStatusOrStatutKey === 'string' &&
      !Object.values(TaskStatus).includes(
        defaultStatusOrStatutKey as TaskStatus
      )
        ? defaultStatusOrStatutKey
        : undefined;
    const defaultStatus =
      defaultStatusOrStatutKey &&
      Object.values(TaskStatus).includes(
        defaultStatusOrStatutKey as TaskStatus
      )
        ? (defaultStatusOrStatutKey as TaskStatus)
        : undefined;

    if (level === 'task') {
      const resolved = buildTaskParent(parent);
      if (!resolved) {
        showErrorToast(
          'Sélectionnez un projet avant de créer une tâche.'
        );
        return;
      }
      if (!resolved.id_list) {
        showErrorToast(LIST_REQUIRED_MSG);
        return;
      }
      setModal({
        open: true,
        level,
        parent: resolved,
        defaultStatus,
        defaultStatutKey:
          defaultStatutKey ??
          (defaultStatus
            ? defaultStatus === TaskStatus.IN_PROGRESS
              ? 'en_cours'
              : defaultStatus === TaskStatus.DONE
                ? 'terminee'
                : 'todo'
            : undefined),
      });
      return;
    }
    setModal({ open: true, level, parent, defaultStatus, defaultStatutKey });
  };

  const spacesForTree = useMemo(() => {
    const toTreeTask = (t: Tache): TreeTaskNode => ({
      id_tache: t.id_tache,
      nom_t: t.nom_t,
      statut_t: t.statut_t ?? null,
      id_list: t.id_list ?? null,
      id_projet: t.id_projet,
      id_sprint: t.id_sprint ?? null,
      priorite_t: t.priorite_t ?? null,
      date_limite_t: t.date_limite_t ?? null,
    });
    return spaces.map((space) => ({
      ...space,
      projects: (space.projects || []).map((project) => ({
        ...project,
        sprints: (project.sprints || []).map((sprint) => ({
          ...sprint,
          lists: (sprint.lists || []).map((list) => {
            const fromApi = list.tasks ?? [];
            const fromState = tasks
              .filter((t) => Number(t.id_list) === Number(list.id_list))
              .map(toTreeTask);
            const byId = new Map<number, TreeTaskNode>();
            for (const t of fromApi) byId.set(t.id_tache, t);
            for (const t of fromState) byId.set(t.id_tache, t);
            const listTasks = Array.from(byId.values());
            return {
              ...list,
              tasks: listTasks,
              task_count: listTasks.length,
            };
          }),
        })),
      })),
    }));
  }, [spaces, tasks]);

  const filteredSpacesForTree = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return spacesForTree;
    return spacesForTree
      .map((space) => ({
        ...space,
        projects: (space.projects || []).filter((p) => {
          const matchProject = (p.nom_p || '').toLowerCase().includes(q);
          const matchChild = (p.sprints || []).some(
            (s) =>
              (s.nom_s || '').toLowerCase().includes(q) ||
              (s.lists || []).some(
                (l) =>
                  (l.nom || '').toLowerCase().includes(q) ||
                  (l.tasks || []).some((t) =>
                    (t.nom_t || '').toLowerCase().includes(q)
                  )
              )
          );
          return (
            matchProject ||
            matchChild ||
            (space.nom || '').toLowerCase().includes(q)
          );
        }),
      }))
      .filter(
        (s) =>
          (s.projects?.length ?? 0) > 0 ||
          (s.nom || '').toLowerCase().includes(q)
      );
  }, [spacesForTree, search]);

  const findTaskInSpaces = (
    taskId: number,
    source: SpaceTreeNode[]
  ): TreeTaskNode | null => {
    for (const space of source) {
      for (const project of space.projects || []) {
        for (const sprint of project.sprints || []) {
          for (const list of sprint.lists || []) {
            const hit = (list.tasks || []).find(
              (t) => t.id_tache === taskId
            );
            if (hit) return hit;
          }
        }
      }
    }
    return null;
  };

  const handleTreeSelect = (sel: SpaceSelection) => {
    if (sel.level === 'task' && sel.id_tache) {
      setTreeSelection(sel);
      if (sel.id_list) setActiveListId(sel.id_list);
      if (sel.id_projet) {
        setActiveProjectId(sel.id_projet);
        const hydrated = hydrateTreeFromSpaces(sel.id_projet, spaces);
        if (hydrated) setTree(hydrated);
      }
      setTreeExpanded((prev) => {
        const next = new Set(prev);
        if (sel.id_projet) next.add(`project:${sel.id_projet}`);
        if (sel.id_sprint) next.add(`sprint:${sel.id_sprint}`);
        if (sel.id_list) next.add(`list:${sel.id_list}`);
        if (sel.id_space) next.add(`space:${sel.id_space}`);
        return next;
      });
      const fromState = tasks.find((t) => t.id_tache === sel.id_tache);
      const fromTree = findTaskInSpaces(sel.id_tache, spacesForTree);
      const snapshot: Tache | null = fromState
        ? fromState
        : fromTree
          ? {
              id_tache: fromTree.id_tache,
              nom_t: fromTree.nom_t,
              statut_t: (fromTree.statut_t as Tache['statut_t']) ?? undefined,
              id_projet: fromTree.id_projet ?? sel.id_projet ?? 0,
              id_sprint: fromTree.id_sprint ?? sel.id_sprint ?? null,
              id_list: fromTree.id_list ?? sel.id_list ?? null,
            }
          : null;
      if (snapshot) setDetailTaskSnapshot(snapshot);
      setDetailTaskId(sel.id_tache);
      setDetailOpen(true);
      setHighlightTaskId(sel.id_tache);
      return;
    }
    if (sel.level === 'list' && sel.id_list) {
      setTreeSelection(sel);
      setActiveListId(sel.id_list);
      if (sel.id_projet) {
        setActiveProjectId(sel.id_projet);
        const hydrated = hydrateTreeFromSpaces(sel.id_projet, spaces);
        if (hydrated) setTree(hydrated);
      }
      setTreeExpanded((prev) => {
        const next = new Set(prev);
        if (sel.id_projet) next.add(`project:${sel.id_projet}`);
        if (sel.id_sprint) next.add(`sprint:${sel.id_sprint}`);
        if (sel.id_list) next.add(`list:${sel.id_list}`);
        if (sel.id_space) next.add(`space:${sel.id_space}`);
        return next;
      });
      return;
    }
    if (sel.level === 'project' && sel.id_projet) {
      setTreeSelection(sel);
      setActiveListId(null);
      setActiveProjectId(sel.id_projet);
      const hydrated = hydrateTreeFromSpaces(sel.id_projet, spaces);
      if (hydrated) setTree(hydrated);
      setTreeExpanded((prev) => {
        const next = new Set(prev);
        next.add(`project:${sel.id_projet}`);
        if (sel.id_space) next.add(`space:${sel.id_space}`);
        return next;
      });
    }
  };

  const handleToggleTreeExpand = (key: string) => {
    setTreeExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleTreeAdd = (
    level: ModalState['level'] | 'space',
    parent: HierarchyParentContext
  ) => {
    if (level === 'project') {
      navigate('/projects');
      return;
    }
    if (level === 'task') {
      openCreate('task', buildTaskParent(parent));
      return;
    }
    const enriched: HierarchyParentContext = {
      ...parent,
      id_projet:
        parent.id_projet ||
        treeSelection?.id_projet ||
        activeProjectId ||
        0,
      id_space: parent.id_space ?? treeSelection?.id_space ?? null,
      id_sprint: parent.id_sprint ?? treeSelection?.id_sprint ?? null,
      id_list: parent.id_list ?? treeSelection?.id_list ?? null,
    };
    openCreate(level as ModalState['level'], enriched);
  };

  const handleAddSuccess = async (created: CreatedHierarchyItem) => {
    const { level, entity } = created;
    if (level === 'space') {
      await fetchSpacesHierarchy(activeProjectId ?? undefined);
      setSuccessMessage('Espace créé avec succès');
      return;
    }
    const projectId =
      activeProjectId ??
      (Number(entity?.id_projet) ||
        Number(created.parent?.id_projet) ||
        0);
    if (!projectId) return;
    if (!activeProjectId) setActiveProjectId(projectId);
    await Promise.all([
      fetchSpacesHierarchy(projectId),
      fetchTree(projectId),
      fetchTasks(projectId),
    ]);
    if (level === 'task' && entity?.id_tache) {
      setHighlightTaskId(entity.id_tache);
      const lid = entity.id_list ? Number(entity.id_list) : null;
      if (lid) {
        setActiveListId(lid);
        setListPageRefreshKey((k) => k + 1);
      }
      setTreeSelection({
        level: 'task',
        id_tache: entity.id_tache,
        id_list: lid ?? undefined,
        id_projet: projectId,
        id_sprint: entity.id_sprint ?? created.parent?.id_sprint ?? undefined,
        id_space: created.parent?.id_space ?? undefined,
        label: entity.nom_t ?? entity.nom ?? 'Tâche',
      });
      setTreeExpanded((prev) => {
        const next = new Set(prev);
        if (created.parent?.id_space) next.add(`space:${created.parent.id_space}`);
        if (entity.id_sprint) next.add(`sprint:${entity.id_sprint}`);
        if (lid) next.add(`list:${lid}`);
        next.add(`project:${projectId}`);
        return next;
      });
    }
    if (level === 'list' && entity?.id_list) {
      const lid = Number(entity.id_list);
      setActiveListId(lid);
      setTreeSelection({
        level: 'list',
        id_list: lid,
        id_projet: activeProjectId ?? undefined,
        id_sprint: entity.id_sprint ?? undefined,
        label: entity.nom ?? 'Liste',
      });
      setListPageRefreshKey((k) => k + 1);
    }
    setSuccessMessage(
      level === 'list'
        ? 'Liste créée avec succès'
        : level === 'sprint'
          ? 'Sprint créé avec succès'
          : 'Tâche créée avec succès'
    );
  };

  const handleDeleteList = async (list: TreeListNode) => {
    if (!canManageList) return;
    if (!window.confirm(`Supprimer la liste "${list.nom}" ?`)) return;
    try {
      await hierarchyService.deleteList(list.id_list);
      if (activeListId === list.id_list) {
        setActiveListId(null);
        setTreeSelection(null);
      }
      if (activeProjectId) {
        await Promise.all([
          fetchSpacesHierarchy(activeProjectId),
          fetchTree(activeProjectId),
          fetchTasks(activeProjectId),
        ]);
      }
      setSuccessMessage('Liste supprimée');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Suppression impossible');
    }
  };

  const treeTaskToTache = (task: TreeTaskNode, ctx: SidebarTaskMenuContext): Tache => ({
    id_tache: task.id_tache,
    nom_t: task.nom_t,
    statut_t: (task.statut_t as Tache['statut_t']) ?? undefined,
    id_projet: task.id_projet ?? ctx.parent.id_projet ?? activeProjectId ?? 0,
    id_sprint: task.id_sprint ?? ctx.parent.id_sprint ?? null,
    id_list: task.id_list ?? ctx.list.id_list ?? null,
    priorite_t: task.priorite_t ?? undefined,
    date_limite_t: task.date_limite_t ?? undefined,
  });

  const openTaskDetail = (task: Tache, ctx?: SidebarTaskMenuContext) => {
    setDetailTaskSnapshot(task);
    setDetailTaskId(task.id_tache);
    setDetailOpen(true);
    setHighlightTaskId(task.id_tache);
    setTreeSelection({
      level: 'task',
      id_tache: task.id_tache,
      id_list: task.id_list ?? ctx?.list.id_list ?? activeListId ?? undefined,
      id_projet: task.id_projet ?? ctx?.parent.id_projet ?? activeProjectId ?? undefined,
      id_sprint: task.id_sprint ?? ctx?.parent.id_sprint ?? undefined,
      id_space: ctx?.spaceId,
      label: task.nom_t,
    });
  };

  const focusListForTask = (ctx: SidebarTaskMenuContext) => {
    const { list, parent, spaceId, task } = ctx;
    setActiveListId(list.id_list);
    if (parent.id_projet) {
      setActiveProjectId(parent.id_projet);
      const hydrated = hydrateTreeFromSpaces(parent.id_projet, spaces);
      if (hydrated) setTree(hydrated);
    }
    setTreeExpanded((prev) => {
      const next = new Set(prev);
      if (parent.id_projet) next.add(`project:${parent.id_projet}`);
      if (parent.id_sprint) next.add(`sprint:${parent.id_sprint}`);
      next.add(`list:${list.id_list}`);
      if (spaceId) next.add(`space:${spaceId}`);
      return next;
    });
    setHighlightTaskId(task.id_tache);
  };

  const handleSidebarTaskMenuAction = (
    action: TreeTaskMenuAction,
    ctx: SidebarTaskMenuContext
  ) => {
    const fullTask =
      tasks.find((t) => t.id_tache === ctx.task.id_tache) ??
      treeTaskToTache(ctx.task, ctx);
    focusListForTask(ctx);

    switch (action) {
      case 'overview':
        setListPageTab('overview');
        openTaskDetail(fullTask, ctx);
        break;
      case 'list':
        setListPageTab('list');
        setTreeSelection({
          level: 'task',
          id_tache: ctx.task.id_tache,
          id_list: ctx.list.id_list,
          id_projet: ctx.parent.id_projet,
          id_sprint: ctx.parent.id_sprint,
          id_space: ctx.spaceId,
          label: ctx.task.nom_t,
        });
        break;
      case 'board':
        setListPageTab('board');
        setTreeSelection({
          level: 'task',
          id_tache: ctx.task.id_tache,
          id_list: ctx.list.id_list,
          id_projet: ctx.parent.id_projet,
          id_sprint: ctx.parent.id_sprint,
          id_space: ctx.spaceId,
          label: ctx.task.nom_t,
        });
        break;
      case 'delete':
        if (canDeleteTask) setPendingDeleteTask(fullTask);
        break;
      default:
        break;
    }
  };

  const executeDeleteTask = async (task: Tache) => {
    if (!canDeleteTask) return;
    setDeletingTask(true);
    setTasks((prev) => prev.filter((t) => t.id_tache !== task.id_tache));
    try {
      await taskService.delete(String(task.id_tache));
      if (detailTaskId === task.id_tache) {
        setDetailOpen(false);
        setDetailTaskId(null);
        setDetailTaskSnapshot(null);
      }
      if (treeSelection?.id_tache === task.id_tache) {
        setTreeSelection({
          level: 'list',
          id_list: task.id_list ?? activeListId ?? undefined,
          id_projet: task.id_projet ?? activeProjectId ?? undefined,
          id_sprint: task.id_sprint ?? undefined,
          label: 'Liste',
        });
      }
      if (activeProjectId) {
        await Promise.all([
          fetchSpacesHierarchy(activeProjectId),
          fetchTasks(activeProjectId),
        ]);
      }
      setListPageRefreshKey((k) => k + 1);
      setSuccessMessage('Tâche supprimée');
    } catch (err: any) {
      if (activeProjectId) {
        await fetchTasks(activeProjectId);
        await fetchSpacesHierarchy(activeProjectId);
      }
      alert(err?.response?.data?.message || 'Suppression impossible');
    } finally {
      setDeletingTask(false);
      setPendingDeleteTask(null);
    }
  };

  const handleDeleteTask = async (task: Tache) => {
    if (!canDeleteTask) return;
    setPendingDeleteTask(task);
  };

  const handleBoardMove = async (taskId: number, target: BoardColumnId) => {
    const task = tasks.find((t) => t.id_tache === taskId);
    if (!task || !activeProjectId) return;

    const optimistic = tasks.map((t) => {
      if (t.id_tache !== taskId) return t;
      if (target === TaskStatus.DONE)
        return { ...t, statut_t: TaskStatus.DONE };
      if (target === 'OVERDUE')
        return {
          ...t,
          date_limite_t: pastDueIso(),
          statut_t:
            t.statut_t === TaskStatus.DONE ? TaskStatus.TODO : t.statut_t,
        };
      if (target === TaskStatus.TODO)
        return {
          ...t,
          statut_t: TaskStatus.TODO,
          date_limite_t: futureDueIso(),
        };
      if (target === TaskStatus.IN_PROGRESS)
        return {
          ...t,
          statut_t: TaskStatus.IN_PROGRESS,
          date_limite_t: futureDueIso(),
        };
      return t;
    });
    setTasks(optimistic);

    try {
      if (target === 'OVERDUE') {
        await taskService.update(String(taskId), {
          date_limite_t: pastDueIso(),
          ...(task.statut_t === TaskStatus.DONE
            ? { statut_t: TaskStatus.TODO }
            : {}),
        });
      } else if (target === TaskStatus.DONE) {
        await taskService.updateStatus(String(taskId), TaskStatus.DONE);
      } else if (isTaskOverdue(task)) {
        await taskService.update(String(taskId), {
          statut_t: target,
          date_limite_t: futureDueIso(),
        });
      } else {
        await taskService.updateStatus(String(taskId), target);
      }
      await fetchTasks(activeProjectId);
    } catch (err: any) {
      await fetchTasks(activeProjectId);
      alert(
        err?.response?.data?.message || 'Impossible de déplacer la tâche'
      );
    }
  };

  const renderTaskRow = (t: Tache) => {
    const due = formatDate(t.date_limite_t);
    const assignee = t.utilisateur
      ? `${t.utilisateur.prenom || ''} ${t.utilisateur.nom || ''}`.trim()
      : '';
    const assigneeRole = t.assignee_project_role;
    const menuOpen = openMenuTaskId === t.id_tache;
    const overdueRow = isTaskOverdue(t);
    return (
      <div
        key={t.id_tache}
        className={`task-row ${overdueRow ? 'task-row-overdue' : ''} ${
          highlightTaskId === t.id_tache ? 'task-row-highlight' : ''
        }`}
        role="button"
        tabIndex={0}
        onClick={() => {
          setDetailTaskId(t.id_tache);
          setDetailOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setDetailTaskId(t.id_tache);
            setDetailOpen(true);
          }
        }}
      >
        <span
          className={`task-row-status status-${t.statut_t}`}
          title={String(t.statut_t)}
        />
        <div className="task-row-info">
          <div className="task-row-title-row">
            <div className="task-row-title">{t.nom_t}</div>
            <span className={`task-row-status-badge st-${t.statut_t}`}>
              {t.statut_t === TaskStatus.TODO
                ? 'À faire'
                : t.statut_t === TaskStatus.IN_PROGRESS
                  ? 'En cours'
                  : 'Terminée'}
            </span>
          </div>
          {t.description_t && (
            <div className="task-row-desc">{t.description_t}</div>
          )}
        </div>
        <div className="task-row-meta">
          {due && (
            <span
              className={`chip date-chip ${overdueRow ? 'date-chip-late' : ''}`}
            >
              <Calendar size={11} /> {due}
            </span>
          )}
          {assignee && (
            <span className="task-row-assignee-wrap" title={assignee}>
              <span className="task-row-assignee-avatar">{initials(assignee)}</span>
              <span className="task-row-assignee-meta">
                <span className="task-row-assignee-name">{assignee}</span>
                {assigneeRole ? (
                  <span className="task-row-assignee-role">{assigneeRole}</span>
                ) : null}
              </span>
            </span>
          )}
          {(canDeleteTask || canEditTask) && (
            <div className="task-row-actions">
              <button
                type="button"
                className="task-row-more"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuTaskId(menuOpen ? null : t.id_tache);
                }}
                title="Actions"
              >
                <MoreHorizontal size={14} />
              </button>
              {menuOpen && (
                <div className="task-row-menu">
                  {canDeleteTask && (
                    <button
                      type="button"
                      className="task-row-menu-item danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTask(t);
                      }}
                    >
                      <Trash2 size={13} /> Supprimer
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderListSection = (
    list: TreeListNode | null,
    items: Tache[],
    keyPrefix: string,
    options?: {
      title?: string;
      mode?: 'inbox' | 'list' | 'sprint';
      sprintId?: number;
    }
  ) => {
    const mode = options?.mode ?? (list === null ? 'inbox' : 'list');
    const isInbox = mode === 'inbox';
    const isSprint = mode === 'sprint';
    const sectionTitle =
      options?.title ??
      (isSprint ? 'Sprint' : isInbox ? 'Sans liste' : list!.nom);
    const sectionParent: HierarchyParentContext =
      isSprint && options?.sprintId
        ? {
            id_projet: activeProjectId as number,
            id_sprint: options.sprintId,
          }
        : isInbox
          ? { id_projet: activeProjectId as number }
          : {
              id_projet: activeProjectId as number,
              id_list: list!.id_list,
              id_sprint: list!.id_sprint ?? undefined,
            };
    return (
      <section className="list-section" key={keyPrefix}>
        <header className="list-section-header">
          <div className="list-section-title">
            <span className="list-section-icon">
              {isSprint ? (
                <LayoutGrid size={14} />
              ) : isInbox ? (
                <Inbox size={14} />
              ) : (
                <ListTodo size={14} />
              )}
            </span>
            <h3>{sectionTitle}</h3>
            <span className="list-section-count">{items.length}</span>
          </div>
          <div className="list-section-actions">
            {canCreateTasksWorkspace && (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => openCreate('task', sectionParent)}
              >
                <Plus size={13} /> Ajouter
              </button>
            )}
            {!isInbox && canManageList && (
              <button
                type="button"
                className="ghost-btn ghost-btn-danger"
                onClick={() => handleDeleteList(list!)}
                title="Supprimer la liste"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </header>

        <div className="list-section-tasks">
          <AnimatePresence initial={false}>
            {items.map((t) => (
              <motion.div
                key={t.id_tache}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {renderTaskRow(t)}
              </motion.div>
            ))}
          </AnimatePresence>

          {items.length === 0 && (
            <div className="list-section-empty">
              {isInbox
                ? 'Aucune tâche orpheline.'
                : 'Aucune tâche pour le moment.'}
            </div>
          )}

        </div>
      </section>
    );
  };

  return (
    <>
      <motion.div
        className={`workspace-page${activeListId ? ' workspace-page--clickup' : ''}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="workspace-layout workspace-layout--full">
          <main className="workspace-main">
            {loadingProjects && (
              <div className="workspace-loading workspace-loading-banner">
                <Loader2 size={16} className="animate-spin" aria-hidden />
                Chargement...
              </div>
            )}
            {error && <div className="workspace-error">{error}</div>}
            <AnimatePresence>
              {successMessage && (
                <motion.div
                  className="workspace-toast"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  role="status"
                  aria-live="polite"
                >
                  <CheckCircle2 size={14} />
                  <span>{successMessage}</span>
                </motion.div>
              )}
              {errorMessage && (
                <motion.div
                  className="workspace-toast workspace-toast--error"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  role="alert"
                  aria-live="assertive"
                >
                  <span>{errorMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {!loadingProjects && !hasAnyProject && (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Globe size={22} />
                </div>
                <h3>Aucun projet</h3>
                <p>
                  Créez un espace et un projet, ou contactez un administrateur
                  pour obtenir un accès.
                </p>
              </div>
            )}

            {!activeListId &&
              activeProjectId &&
              !loadingProjects &&
              !error && (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <ListTodo size={22} />
                </div>
                <h3>Sélectionnez une liste</h3>
                <p>
                  Développez un espace dans le menu de gauche, puis sélectionnez
                  une liste pour ouvrir sa page.
                </p>
              </div>
            )}

            {!activeListId && !activeProjectId && hasAnyProject && !error && (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Briefcase size={22} />
                </div>
                <h3>Sélectionnez un projet</h3>
                <p>
                  Choisissez un projet puis une liste dans le menu Espaces à
                  gauche.
                </p>
              </div>
            )}

            {activeListId && (
              <ListPageView
                key={String(activeListId)}
                listId={activeListId}
                refreshKey={listPageRefreshKey}
                canCreateTask={canCreateTasksWorkspace}
                canEditTask={canEditTask}
                canDeleteTask={canDeleteTask}
                onOpenCreateTask={(parent, status) => {
                  if (!parent?.id_list && !activeListId) {
                    showErrorToast(LIST_REQUIRED_MSG);
                    return;
                  }
                  openCreate(
                    'task',
                    parent ?? buildTaskParent(null),
                    status
                  );
                }}
                onRefreshHierarchy={async () => {
                  if (activeProjectId) {
                    await fetchSpacesHierarchy(activeProjectId);
                    await fetchTree(activeProjectId);
                    await fetchTasks(activeProjectId);
                  }
                }}
                onToggleTeam={toggleTeamPanel}
                clickUpMode
              />
            )}
          </main>
        </div>
      </motion.div>

      <TaskDeleteConfirmModal
        open={!!pendingDeleteTask}
        taskName={pendingDeleteTask?.nom_t ?? ''}
        loading={deletingTask}
        onCancel={() => !deletingTask && setPendingDeleteTask(null)}
        onConfirm={() => {
          if (pendingDeleteTask) void executeDeleteTask(pendingDeleteTask);
        }}
      />

      <CreateHierarchyItemModal
        isOpen={modal.open}
        level={modal.level}
        parent={modal.parent}
        defaultStatutKey={modal.defaultStatutKey}
        onClose={() => setModal({ ...modal, open: false })}
        onSuccess={handleAddSuccess}
        onError={showErrorToast}
        taskListOptions={
          modal.parent?.id_sprint
            ? allLists
                .filter(
                  (l) =>
                    Number(l.id_sprint) === Number(modal.parent?.id_sprint)
                )
                .map((l) => ({ id: l.id_list, label: l.nom }))
            : allLists.map((l) => ({ id: l.id_list, label: l.nom }))
        }
        taskSprintOptions={flatTreeSprints.map((s) => ({
          id: s.id_sprint,
          label: s.nom_s,
        }))}
      />

      <WorkspaceTaskDetailPanel
        task={detailTask}
        open={detailOpen && !!detailTask}
        listLabel={
          detailTask?.id_list
            ? listLookup[detailTask.id_list]
            : undefined
        }
        canEdit={canEditTask}
        onClose={() => {
          setDetailOpen(false);
          setDetailTaskId(null);
        }}
        onSaved={(updated) =>
          setTasks((prev) =>
            prev.map((x) =>
              x.id_tache === updated.id_tache ? updated : x
            )
          )
        }
      />

      <AnimatePresence>
        {teamPanelOpen && activeProjectId != null && (
          <>
            <motion.div
              key="ws-team-overlay"
              className="ws-team-overlay"
              role="presentation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTeamPanelOpen(false)}
            />
            <motion.aside
              key="ws-team-panel"
              className="ws-team-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ws-team-panel-title"
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            >
              <header className="ws-team-panel-header">
                <div className="ws-team-panel-head-text">
                  <h2 id="ws-team-panel-title">Équipe du projet</h2>
                  <p className="ws-team-sub">{tree?.nom_p || 'Projet'}</p>
                </div>
                <button
                  type="button"
                  className="ws-team-close"
                  aria-label="Fermer"
                  onClick={() => setTeamPanelOpen(false)}
                >
                  ×
                </button>
              </header>
              <div className="ws-team-panel-body">
                {loadingProjectDetail ? (
                  <div className="ws-team-loading">
                    <Loader2 className="animate-spin" size={22} aria-hidden />
                    <span>Chargement…</span>
                  </div>
                ) : projectTeamRows.length === 0 ? (
                  <p className="ws-team-empty">Aucun membre trouvé.</p>
                ) : (
                  <>
                    {projectTeamChef ? (
                      <div className="ws-team-chef-block">
                        <span className="ws-team-section-label">Chef de projet</span>
                        <div className="ws-team-chef-card">
                          <span className="ws-team-avatar ws-team-avatar--chef" aria-hidden>
                            {initials(projectTeamChef.name)}
                          </span>
                          <div className="ws-team-member-text">
                            <p className="ws-team-member-name">{projectTeamChef.name}</p>
                            {projectTeamChef.email ? (
                              <p className="ws-team-member-email">{projectTeamChef.email}</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {projectTeamOthers.length > 0 ? (
                      <div className="ws-team-members-block">
                        <span className="ws-team-section-label">Membres</span>
                        <ul className="ws-team-list">
                          {projectTeamOthers.map((m) => (
                            <li key={m.userId} className="ws-team-row">
                              <span className="ws-team-avatar" aria-hidden>
                                {initials(m.name)}
                              </span>
                              <div className="ws-team-member-text">
                                <p className="ws-team-member-name">{m.name}</p>
                                <p className="ws-team-member-role">{m.roleProjet}</p>
                                {m.email ? (
                                  <p className="ws-team-member-email">{m.email}</p>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

    </>
  );
};

export default Workspace;
