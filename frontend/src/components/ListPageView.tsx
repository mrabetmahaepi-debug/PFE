import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Loader2,
  CheckSquare,
  CircleDashed,
  CircleDotDashed,
  Users,
  RefreshCw,
  Filter,
  Briefcase,
  ChevronRight,
  SlidersHorizontal,
  LayoutList,
  LayoutGrid,
} from 'lucide-react';
import { hierarchyService } from '../services/hierarchy.service';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import { normalizeTaskStatutKey } from '../lib/listStatusGroups';
import type { ListDetail } from '../types/hierarchy';
import { TaskStatus, type Tache } from '../types/task';
import type { Projet } from '../types/project';
import type { HierarchyParentContext } from './CreateHierarchyItemModal';
import KanbanBoard, { isTaskOverdue, type BoardColumnId } from './KanbanBoard';
import ListStatusGroupedView from './ListStatusGroupedView';
import ListTaskView from './ListTaskView';
import KanbanBoardView from './KanbanBoardView';
import CalendarTaskView from './CalendarTaskView';
import TableurTaskView from './TableurTaskView';
import GanttTaskView from './GanttTaskView';
import ClickUpListViewTabs, {
  type ClickUpViewTabId,
} from './ClickUpListViewTabs';
import ClickUpListViewFilters from './ClickUpListViewFilters';
import {
  DEFAULT_CLICKUP_VISIBLE_COLUMNS,
  type ListViewColumnKey,
} from '../lib/listViewColumns';
import type { ClickUpColumnId } from './ClickUpKanbanBoard';
import { ListPageProvider, type ListPageContextValue } from './listPageContext';
import './ClickUpListToolbar.css';
import './ClickUpListViewTabs.css';
import './ClickUpListViewFilters.css';
import WorkspaceFilterDropdown from './WorkspaceFilterDropdown';
import { taskStatusToStatutKey } from '../lib/listStatusGroups';
import { useAuth } from '../hooks/useAuth';
import { usePermission } from '../hooks/usePermission';
import { getRoleKey, isGlobalMember } from '../lib/permissions';
import { canChangeTaskStatusForTask, resolveEffectiveProjectPermissions } from '../lib/projectPermissions';
import { permissionDeniedFromError } from '../lib/permissionDenied';
import { useSetMemberTopbarTitle } from '../context/MemberTopbarTitleContext';
import './ListPageView.css';

export type ListPageTab = 'overview' | 'list' | 'board';
type ListTab = ListPageTab;
type AssigneeFilter = 'all' | number;
type DueFilter = 'all' | 'today' | 'week' | 'overdue' | 'none';

function initials(label?: string) {
  if (!label) return '?';
  const parts = label.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(raw?: string | null) {
  if (!raw) return null;
  try {
    return new Date(raw).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return null;
  }
}

export interface ListPageViewProps {
  listId: number;
  canCreateTask: boolean;
  canEditTask: boolean;
  canDeleteTask: boolean;
  onOpenCreateTask: (
    parent: HierarchyParentContext,
    defaultStatusOrStatutKey?: TaskStatus | string
  ) => void;
  /** Optional — row click navigates to /tasks/:id by default */
  onTaskClick?: (task: Tache) => void;
  onRefreshHierarchy: () => Promise<void>;
  onToggleTeam?: () => void;
  highlightTaskId?: number | null;
  activeTab?: ListPageTab;
  onTabChange?: (tab: ListPageTab) => void;
  /** ClickUp-style minimal list page without dashboard chrome */
  clickUpMode?: boolean;
  /** Increment to reload list data without remounting (preserves viewMode). */
  refreshKey?: number;
}

const ListPageView: React.FC<ListPageViewProps> = ({
  listId,
  canCreateTask,
  canEditTask,
  canDeleteTask,
  onOpenCreateTask,
  onTaskClick,
  onRefreshHierarchy,
  onToggleTeam,
  highlightTaskId,
  activeTab: controlledTab,
  onTabChange,
  clickUpMode = false,
  refreshKey = 0,
}) => {
  const { user } = useAuth();
  const { isSuperAdmin } = usePermission();
  const [listDetail, setListDetail] = useState<ListDetail | null>(null);
  const [projectDetail, setProjectDetail] = useState<Projet | null>(null);
  const [tasks, setTasks] = useState<Tache[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [internalTab, setInternalTab] = useState<ListTab>('list');
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = (tab: ListTab) => {
    onTabChange?.(tab);
    if (controlledTab === undefined) setInternalTab(tab);
  };
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all');
  const [dueFilter, setDueFilter] = useState<DueFilter>('all');
  const [statusSavingId, setStatusSavingId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ClickUpViewTabId>('list');
  const [showSubtasks, setShowSubtasks] = useState(true);
  const [showClosed, setShowClosed] = useState(true);
  const [listSearch, setListSearch] = useState('');
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(
    DEFAULT_CLICKUP_VISIBLE_COLUMNS
  );

  const toggleListColumn = (key: ListViewColumnKey) => {
    if (key === 'name') return;
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [detail, listTasks] = await Promise.all([
        hierarchyService.getListById(listId),
        hierarchyService.getListTasks(listId),
      ]);
      setListDetail(detail);
      setTasks(listTasks);

      if (detail.currentUserPermissions?.length) {
        setProjectDetail({
          id_projet: detail.id_projet,
          nom_p: detail.projet?.nom_p ?? 'Projet',
          currentUserPermissions: detail.currentUserPermissions,
          currentUserProjectRole: detail.currentUserProjectRole ?? null,
        } as Projet);
      }

      try {
        const p = await projectService.getById(detail.id_projet);
        setProjectDetail(p);
      } catch (projectErr: unknown) {
        const ax = projectErr as { response?: { status?: number } };
        if (ax?.response?.status === 403 && !detail.currentUserPermissions?.length) {
          throw projectErr;
        }
        if (!detail.currentUserPermissions?.length) {
          setProjectDetail(null);
        }
      }
    } catch (err: unknown) {
      setListDetail(null);
      setTasks([]);
      const ax = err as { response?: { status?: number } };
      if (ax?.response?.status === 403) {
        setError(permissionDeniedFromError(err));
      } else {
        const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
        setError(
          anyErr?.response?.data?.message ||
            anyErr?.message ||
            'Impossible de charger la liste'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    setListSearch('');
    setFilterOpen(false);
    setColumnsOpen(false);
    setAssigneeMenuOpen(false);
  }, [listId]);

  useEffect(() => {
    if (controlledTab !== undefined) setInternalTab(controlledTab);
  }, [controlledTab]);

  const parentCtx: HierarchyParentContext | null = useMemo(() => {
    if (!listDetail) return null;
    return {
      id_projet: listDetail.id_projet,
      id_sprint: listDetail.id_sprint ?? null,
      id_list: listDetail.id_list,
      id_space: listDetail.projet?.id_space ?? null,
    };
  }, [listDetail]);

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (assigneeFilter !== 'all') {
      list = list.filter((t) => t.assigne_a === assigneeFilter);
    }
    if (dueFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
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
        if (dueFilter === 'week') return dt >= tt && dt <= weekEnd.getTime();
        return false;
      });
    }
    return list;
  }, [tasks, assigneeFilter, dueFilter]);

  const displayTasks = useMemo(() => {
    if (showSubtasks) return filteredTasks;
    return filteredTasks.filter((t) => !t.id_parent_tache);
  }, [filteredTasks, showSubtasks]);

  const counts = useMemo(() => {
    let todo = 0;
    let inProgress = 0;
    let done = 0;
    for (const t of tasks) {
      if (t.statut_t === TaskStatus.TODO) todo++;
      else if (t.statut_t === TaskStatus.IN_PROGRESS) inProgress++;
      else if (t.statut_t === TaskStatus.DONE) done++;
    }
    return { todo, inProgress, done, total: tasks.length };
  }, [tasks]);

  const progressPercent = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round((counts.done / tasks.length) * 100);
  }, [tasks.length, counts.done]);

  const projectPermissions = useMemo(
    () => projectDetail?.currentUserPermissions ?? [],
    [projectDetail?.currentUserPermissions]
  );

  const canEditTaskStatusFor = useCallback(
    (task: Tache) => {
      const localRole = projectDetail?.currentUserProjectRole ?? null;
      const perms = resolveEffectiveProjectPermissions(
        projectPermissions,
        user?.permissions ?? []
      );
      const isAdmin =
        isSuperAdmin ||
        getRoleKey(user) === 'ADMIN';
      return canChangeTaskStatusForTask(
        perms,
        task,
        user?.id_utilisateur,
        { localRole, isAdmin }
      );
    },
    [user, projectPermissions, projectDetail?.currentUserProjectRole, isSuperAdmin]
  );

  const projectMembers = useMemo(() => {
    const team = projectDetail?.projectTeam ?? [];
    return team
      .filter((m) => m.userId != null)
      .map((m) => ({
        id: Number(m.userId),
        label:
          `${m.prenom || ''} ${m.nom || ''}`.trim() || m.email || 'Membre',
      }));
  }, [projectDetail]);

  const assigneeOptions = useMemo(() => {
    const m = new Map<number, string>();
    for (const mem of projectMembers) {
      m.set(mem.id, mem.label);
    }
    for (const t of tasks) {
      if (t.assigne_a && t.utilisateur) {
        const label =
          `${t.utilisateur.prenom || ''} ${t.utilisateur.nom || ''}`.trim() ||
          t.utilisateur.email ||
          '';
        m.set(t.assigne_a, label);
      }
    }
    return Array.from(m.entries()).map(([id, label]) => ({ id, label }));
  }, [tasks, projectMembers]);

  const memberListNavbarTitle =
    isGlobalMember(user) && clickUpMode && listDetail?.nom
      ? listDetail.nom
      : null;
  useSetMemberTopbarTitle(memberListNavbarTitle);

  const handleBoardMove = async (taskId: number, target: BoardColumnId) => {
    const task = tasks.find((t) => t.id_tache === taskId);
    if (!task || !canEditTaskStatusFor(task)) {
      alert("Vous n'avez pas l'autorisation de modifier le statut de cette tâche.");
      throw new Error('PROJECT_PERMISSION_DENIED');
    }
    const normalized = normalizeTaskStatutKey(target);
    const previous = tasks;
    setTasks((prev) =>
      prev.map((t) =>
        t.id_tache === taskId ? { ...t, statut_t: normalized } : t
      )
    );
    try {
      const updated = await taskService.patchStatus(String(taskId), target);
      setTasks((prev) =>
        prev.map((t) => (t.id_tache === taskId ? updated : t))
      );
      await onRefreshHierarchy();
    } catch (err: unknown) {
      setTasks(previous);
      const ax = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      alert(
        permissionDeniedFromError(err) ||
          ax?.response?.data?.message ||
          ax?.message ||
          'Impossible de déplacer la tâche'
      );
      throw err;
    }
  };

  const handleClickUpBoardMove = async (
    taskId: number,
    statutKey: ClickUpColumnId
  ) => {
    const task = tasks.find((t) => t.id_tache === taskId);
    if (!task || !canEditTaskStatusFor(task)) {
      alert("Vous n'avez pas l'autorisation de modifier le statut de cette tâche.");
      throw new Error('PROJECT_PERMISSION_DENIED');
    }
    const normalized = normalizeTaskStatutKey(statutKey);
    const previous = tasks;
    setTasks((prev) =>
      prev.map((t) =>
        t.id_tache === taskId ? { ...t, statut_t: normalized } : t
      )
    );
    setStatusSavingId(taskId);
    try {
      const updated = await taskService.patchStatus(String(taskId), statutKey);
      setTasks((prev) =>
        prev.map((t) => (t.id_tache === taskId ? updated : t))
      );
      await onRefreshHierarchy();
    } catch (err: unknown) {
      setTasks(previous);
      const ax = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      alert(
        permissionDeniedFromError(err) ||
          ax?.response?.data?.message ||
          ax?.message ||
          'Impossible de déplacer la tâche'
      );
      throw err;
    } finally {
      setStatusSavingId(null);
    }
  };

  const handleRefresh = async () => {
    await load();
    await onRefreshHierarchy();
  };

  const handleTaskStatusChange = async (taskId: number, statutKey: string) => {
    const task = tasks.find((t) => t.id_tache === taskId);
    if (!task || !canEditTaskStatusFor(task)) return;
    setStatusSavingId(taskId);
    try {
      await taskService.patchStatus(String(taskId), statutKey);
      setTasks((prev) =>
        prev.map((t) =>
          t.id_tache === taskId
            ? { ...t, statut_t: normalizeTaskStatutKey(statutKey) }
            : t
        )
      );
      await onRefreshHierarchy();
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      alert(
        ax?.response?.data?.message ||
          ax?.message ||
          'Impossible de mettre à jour le statut'
      );
      await load();
    } finally {
      setStatusSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="list-page list-page--loading">
        <Loader2 size={20} className="animate-spin" />
        <span>Chargement de la liste…</span>
      </div>
    );
  }

  if (error || !listDetail || !parentCtx) {
    return (
      <div className="list-page list-page--error">
        <p>{error || 'Liste introuvable'}</p>
        <button type="button" className="secondary-btn" onClick={() => void load()}>
          <RefreshCw size={14} /> Réessayer
        </button>
      </div>
    );
  }

  const projectName = listDetail.projet?.nom_p ?? 'Projet';
  const sprintName = listDetail.sprint?.nom_s;

  if (clickUpMode) {
    const listPageContextValue: ListPageContextValue = {
      listId,
      listName: listDetail.nom,
      projectName: projectName,
      parentCtx,
      tasks: displayTasks,
      canCreateTask,
      canEditTask,
      canEditTaskStatusFor,
      highlightTaskId,
      onOpenCreateTask: (statutKey) => onOpenCreateTask(parentCtx, statutKey ?? 'todo'),
      onTaskClick,
      onStatusesChange: () => {
        void load();
        void onRefreshHierarchy();
      },
      assigneeOptions,
      projectMembers,
      onTaskFieldChange: async (taskId, patch) => {
        const payload: Record<string, unknown> = { ...patch };
        if (patch.date_limite_t === null) {
          payload.date_limite_t = '';
        }
        const tasksBefore = tasks;
        if (patch.priorite_t !== undefined) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id_tache === taskId
                ? { ...t, priorite_t: patch.priorite_t! }
                : t
            )
          );
        }
        try {
          await taskService.update(String(taskId), payload);
          await load();
          await onRefreshHierarchy();
        } catch (err: unknown) {
          if (patch.priorite_t !== undefined) {
            setTasks(tasksBefore);
          }
          const ax = err as {
            response?: { data?: { message?: string } };
            message?: string;
          };
          alert(
            ax?.response?.data?.message ||
              ax?.message ||
              'Impossible de mettre à jour la tâche'
          );
        }
      },
      onTaskStatusChange: handleTaskStatusChange,
      onBoardMove: handleClickUpBoardMove,
      savingStatusTaskId: statusSavingId,
    };

    const handleViewTabChange = (tab: ClickUpViewTabId) => {
      setViewMode(tab);
    };

    const bodyModeClass =
      viewMode === 'board'
        ? 'list-page-body--board'
        : viewMode === 'calendar'
          ? 'list-page-body--calendar'
          : viewMode === 'tableur'
            ? 'list-page-body--tableur'
            : viewMode === 'gantt'
              ? 'list-page-body--gantt'
              : '';

    return (
      <ListPageProvider value={listPageContextValue}>
        <div
          className={`list-page list-page--clickup${
            memberListNavbarTitle ? ' list-page--member-navbar-title' : ''
          }`}
        >
          {!memberListNavbarTitle && (
            <div className="cu-list-toolbar-top-wrap">
              <h1 className="cu-list-toolbar-title">{listDetail.nom}</h1>
            </div>
          )}
          <ClickUpListViewTabs
            activeTab={viewMode}
            onTabChange={handleViewTabChange}
          />
          {viewMode === 'list' && (
            <ClickUpListViewFilters
              showSubtasks={showSubtasks}
              onToggleSubtasks={() => setShowSubtasks((v) => !v)}
              showClosed={showClosed}
              onToggleClosed={() => setShowClosed((v) => !v)}
              searchQuery={listSearch}
              onSearchChange={setListSearch}
              visibleColumns={visibleColumns}
              onToggleColumn={toggleListColumn}
              columnsOpen={columnsOpen}
              onColumnsOpenChange={setColumnsOpen}
              filterOpen={filterOpen}
              onToggleFilter={() => setFilterOpen((v) => !v)}
              assigneeFilter={assigneeFilter}
              assigneeOptions={assigneeOptions}
              onAssigneeFilterChange={(v) =>
                setAssigneeFilter(v === 'all' ? 'all' : v)
              }
              assigneeMenuOpen={assigneeMenuOpen}
              onAssigneeMenuOpenChange={setAssigneeMenuOpen}
              canCreateTask={canCreateTask}
              onAddTask={() => onOpenCreateTask(parentCtx, 'todo')}
              filterExtras={
                <>
                  <WorkspaceFilterDropdown
                    ariaLabel="Échéance"
                    value={dueFilter}
                    onChange={(v) => setDueFilter(v as DueFilter)}
                    options={[
                      { value: 'all', label: 'Toutes échéances' },
                      { value: 'today', label: "Aujourd'hui" },
                      { value: 'week', label: 'Cette semaine' },
                      { value: 'overdue', label: 'En retard' },
                      { value: 'none', label: 'Sans date' },
                    ]}
                  />
                </>
              }
            />
          )}
          <div
            className={`list-page-body list-page-body--clickup ${bodyModeClass}`.trim()}
            data-view-mode={viewMode}
          >
            {!loading && tasks.length === 0 ? (
              <div className="list-page-empty-accessible" role="status">
                <p>Aucune tâche accessible</p>
              </div>
            ) : (
              <>
                {viewMode === 'list' && (
                  <ListTaskView
                    listId={listId}
                    searchQuery={listSearch}
                    showClosed={showClosed}
                    visibleColumns={visibleColumns}
                  />
                )}
                {viewMode === 'board' && <KanbanBoardView listId={listId} />}
                {viewMode === 'calendar' && <CalendarTaskView listId={listId} />}
                {viewMode === 'gantt' && <GanttTaskView listId={listId} />}
                {viewMode === 'tableur' && <TableurTaskView listId={listId} />}
              </>
            )}
          </div>
        </div>
      </ListPageProvider>
    );
  }

  return (
    <div className="list-page">
      <nav className="list-page-breadcrumbs" aria-label="Fil d'Ariane">
        <span>{projectName}</span>
        {sprintName && (
          <>
            <ChevronRight size={12} className="list-page-breadcrumb-sep" aria-hidden />
            <span>{sprintName}</span>
          </>
        )}
        <ChevronRight size={12} className="list-page-breadcrumb-sep" aria-hidden />
        <span className="list-page-breadcrumb-current">{listDetail.nom}</span>
      </nav>

      <header className="list-page-header">
        <div className="list-page-headline">
          <h1 className="list-page-main-title">Tâches</h1>
          <p className="list-page-project-line">
            <Briefcase size={13} aria-hidden />
            {projectName}
            {sprintName ? ` · ${sprintName}` : ''} · {listDetail.nom}
          </p>
          <div className="list-page-stats">
            <span className="stat-pill">
              <CircleDashed size={11} aria-hidden /> {counts.todo} à faire
            </span>
            <span className="stat-pill">
              <CircleDotDashed size={11} aria-hidden /> {counts.inProgress} en cours
            </span>
            <span className="stat-pill">
              <CheckSquare size={11} aria-hidden /> {counts.done} terminées
            </span>
          </div>
        </div>
        <div className="list-page-side">
          <div className="list-page-progress-wrap">
            <div className="list-page-progress-track">
              <motion.div
                className="list-page-progress-fill"
                initial={false}
                animate={{ width: `${progressPercent}%` }}
                transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              />
            </div>
            <span className="list-page-progress-label">{progressPercent}%</span>
          </div>
          {projectMembers.length > 0 && (
            <div
              className="member-stack"
              title={projectMembers.map((m) => m.label).join(', ')}
            >
              {projectMembers.slice(0, 5).map((m) => (
                <span key={m.id} className="member-avatar" title={m.label}>
                  {initials(m.label)}
                </span>
              ))}
              {projectMembers.length > 5 && (
                <span className="member-avatar member-avatar-more">
                  +{projectMembers.length - 5}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <nav className="list-page-tabs" aria-label="Vues de la liste">
        <button
          type="button"
          className={`list-page-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Aperçu
        </button>
        <button
          type="button"
          className={`list-page-tab ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          <LayoutList size={14} style={{ marginRight: 4, verticalAlign: -2 }} aria-hidden />
          Liste <span className="tab-count">{counts.total}</span>
        </button>
        <button
          type="button"
          className={`list-page-tab ${activeTab === 'board' ? 'active' : ''}`}
          onClick={() => setActiveTab('board')}
        >
          <LayoutGrid size={14} style={{ marginRight: 4, verticalAlign: -2 }} aria-hidden />
          Tableau
        </button>
      </nav>

      <div className="list-page-toolbar">
        <div className="list-page-toolbar-left">
          <button type="button" className="cu-toolbar-chip">
            <Filter size={14} aria-hidden />
            Filtrer
          </button>
          <button type="button" className="cu-toolbar-chip cu-toolbar-chip--accent">
            <span className="cu-toolbar-chip-label">Grouper par :</span>
            Statut
          </button>
          {onToggleTeam && (
            <button type="button" className="cu-toolbar-chip" onClick={onToggleTeam}>
              <Users size={14} aria-hidden />
              Assignés
            </button>
          )}
        </div>
        <div className="list-page-toolbar-right">
          <button
            type="button"
            className="secondary-btn"
            onClick={() => void handleRefresh()}
            title="Actualiser"
          >
            <RefreshCw size={14} />
          </button>
          <button type="button" className="cu-toolbar-chip">
            <SlidersHorizontal size={14} aria-hidden />
            Personnaliser
          </button>
          {canCreateTask && (
            <button
              type="button"
              className="primary-btn"
              disabled={!parentCtx}
              onClick={() => {
                if (!parentCtx) return;
                onOpenCreateTask(parentCtx);
              }}
            >
              <Plus size={14} /> Ajouter une tâche
            </button>
          )}
        </div>
      </div>

      <div className="workspace-filters-bar list-page-filters">
        <span className="workspace-filters-label">
          <Filter size={14} aria-hidden />
          Filtres
        </span>
        <div className="workspace-filters-controls">
          <WorkspaceFilterDropdown
            ariaLabel="Projet"
            value={String(listDetail.id_projet)}
            onChange={() => {}}
            options={[
              {
                value: String(listDetail.id_projet),
                label: listDetail.projet?.nom_p ?? 'Projet',
              },
            ]}
          />
          {listDetail.id_sprint != null && (
            <WorkspaceFilterDropdown
              ariaLabel="Sprint"
              value={String(listDetail.id_sprint)}
              onChange={() => {}}
              options={[
                {
                  value: String(listDetail.id_sprint),
                  label: listDetail.sprint?.nom_s ?? 'Sprint',
                },
              ]}
            />
          )}
          <WorkspaceFilterDropdown
            ariaLabel="Assigné"
            value={assigneeFilter === 'all' ? 'all' : String(assigneeFilter)}
            onChange={(v) =>
              setAssigneeFilter(v === 'all' ? 'all' : Number(v))
            }
            options={[
              { value: 'all', label: 'Tous les assignés' },
              ...assigneeOptions.map(({ id, label }) => ({
                value: String(id),
                label,
              })),
            ]}
          />
          <WorkspaceFilterDropdown
            ariaLabel="Échéance"
            value={dueFilter}
            onChange={(v) => setDueFilter(v as DueFilter)}
            options={[
              { value: 'all', label: 'Toutes échéances' },
              { value: 'today', label: "Aujourd'hui" },
              { value: 'week', label: 'Cette semaine' },
              { value: 'overdue', label: 'En retard' },
              { value: 'none', label: 'Sans date' },
            ]}
          />
        </div>
      </div>

      <div className="list-page-body">
        {activeTab === 'overview' && (
          <div className="list-page-overview">
            <h3>Résumé</h3>
            <p>
              {counts.total} tâche{counts.total !== 1 ? 's' : ''} dans cette
              liste. Utilisez l&apos;onglet <strong>List</strong> pour gérer les
              tâches ou <strong>Board</strong> pour la vue Kanban.
            </p>
            <div className="list-page-overview-grid">
              <div className="list-page-overview-card">
                <span className="label">À faire</span>
                <span className="value">{counts.todo}</span>
              </div>
              <div className="list-page-overview-card">
                <span className="label">En cours</span>
                <span className="value">{counts.inProgress}</span>
              </div>
              <div className="list-page-overview-card">
                <span className="label">Terminées</span>
                <span className="value">{counts.done}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'list' && (
          <ListStatusGroupedView
            listId={listId}
            listName={listDetail.nom}
            tasks={filteredTasks}
            parentCtx={parentCtx}
            canCreateTask={canCreateTask}
            highlightTaskId={highlightTaskId}
            onAddTask={(ctx, statutKey) =>
              onOpenCreateTask(ctx, statutKey)
            }
            onTaskClick={onTaskClick}
            onStatusesChange={() => {
              void load();
              void onRefreshHierarchy();
            }}
            canEditStatus={canEditTask}
            canEditStatusFor={canEditTaskStatusFor}
            onTaskStatusChange={handleTaskStatusChange}
            savingStatusTaskId={statusSavingId}
          />
        )}

        {activeTab === 'board' && (
          <KanbanBoard
            tasks={filteredTasks}
            listLookup={{ [listId]: listDetail.nom }}
            canCreateTask={canCreateTask}
            canReorderTask={canEditTaskStatusFor}
            canReorderTasks={filteredTasks.some((t) => canEditTaskStatusFor(t))}
            onAddTask={(status) =>
              onOpenCreateTask(parentCtx, taskStatusToStatutKey(status))
            }
            onMoveTask={handleBoardMove}
            highlightTaskId={highlightTaskId ?? null}
            onTaskClick={onTaskClick}
          />
        )}
      </div>
    </div>
  );
};

export default ListPageView;
