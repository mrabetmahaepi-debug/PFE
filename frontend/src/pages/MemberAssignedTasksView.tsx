import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  Columns3,
  Layers,
} from 'lucide-react';
import { type Tache, type TaskPriority } from '../types/task';
import MemberPriorityTextSelect from '../components/MemberPriorityTextSelect';
import { appPaths } from '../lib/workspaceRoutes';
import { normalizeTaskStatutKey } from '../lib/listStatusGroups';
import {
  KANBAN_WORKFLOW_COLUMNS,
  type KanbanWorkflowColumnId,
} from '../lib/kanbanWorkflowColumns';
import {
  kanbanColumnToPillTone,
  memberStatusPillClass,
} from '../lib/memberStatusPill';
import '../styles/memberStatusPill.css';
import {
  getOrderedVisibleColumns,
  loadMemberAssignedColumnVisibility,
  MEMBER_ASSIGNED_COLUMN_LABELS,
  saveMemberAssignedColumnVisibility,
  type MemberAssignedColumnKey,
  type MemberAssignedColumnVisibility,
} from '../lib/memberAssignedColumns';
import MemberAssignedColumnsPanel from '../components/MemberAssignedColumnsPanel';
import MemberAssignedFilterMenu from '../components/MemberAssignedFilterMenu';
import MemberTasksPageCardHeader from '../components/MemberTasksPageCardHeader';
import {
  EMPTY_MEMBER_ASSIGNED_FILTERS,
  filterMemberAssignedTaskList,
  groupMemberAssignedTasksByStatus,
  hasActiveMemberAssignedFilters,
  type MemberAssignedListFilters,
} from '../lib/memberAssignedFilters';
import './MemberAssignedTasksView.css';

const TABLE_HEADER_SHORT: Partial<Record<MemberAssignedColumnKey, string>> = {
  name: 'Nom',
  dueDate: 'Date d\'échéance',
  priority: 'Priorité',
  comments: 'Commentaires',
  assignedComments: 'Com. assignés',
  createdBy: 'Créé par',
};

function formatDueDateShort(raw?: string | null): string {
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
  } catch {
    return '—';
  }
}

function creatorLabel(task: Tache): string {
  if (!task.createur) return '—';
  const name =
    `${task.createur.prenom || ''} ${task.createur.nom || ''}`.trim();
  return name || task.createur.email || '—';
}

function stopRow(e: React.MouseEvent) {
  e.stopPropagation();
}

function renderColumnCell(
  key: MemberAssignedColumnKey,
  task: Tache,
  isDone: boolean,
  onPriorityChange?: (task: Tache, priority: TaskPriority) => void
): React.ReactNode {
  switch (key) {
    case 'name':
      return (
        <span className="member-assigned-task-label">{task.nom_t}</span>
      );
    case 'priority':
      return (
        <MemberPriorityTextSelect
          priority={task.priorite_t}
          canEdit={!!onPriorityChange}
          onChange={(prio) => onPriorityChange?.(task, prio)}
        />
      );
    case 'dueDate':
      return formatDueDateShort(task.date_limite_t);
    case 'comments':
    case 'assignedComments':
      return <span className="member-assigned-cell-muted">—</span>;
    case 'createdBy':
      return (
        <span className="member-assigned-cell-text">{creatorLabel(task)}</span>
      );
    default:
      return null;
  }
}

function columnCellClass(key: MemberAssignedColumnKey): string {
  if (key === 'name') return 'member-assigned-td-name';
  if (key === 'priority') return 'member-assigned-td-priority';
  if (key === 'dueDate') return 'member-assigned-td-due';
  return 'member-assigned-td-extra';
}

interface MemberAssignedTasksViewProps {
  tasks: Tache[];
  loading: boolean;
  onToggleCheck: (t: Tache, e: React.MouseEvent) => void | Promise<void>;
  initialFilters?: MemberAssignedListFilters;
  onAddTask?: () => void;
  onPriorityChange?: (task: Tache, priority: TaskPriority) => void | Promise<void>;
  expandTodoGroup?: boolean;
  onTodoGroupExpanded?: () => void;
}

const MemberAssignedTasksView: React.FC<MemberAssignedTasksViewProps> = ({
  tasks,
  loading,
  onToggleCheck,
  initialFilters,
  onAddTask,
  onPriorityChange,
  expandTodoGroup = false,
  onTodoGroupExpanded,
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showClosed, setShowClosed] = useState(
    () => initialFilters?.status === 'terminee'
  );
  const [columnsPanelOpen, setColumnsPanelOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] =
    useState<MemberAssignedColumnVisibility>(loadMemberAssignedColumnVisibility);
  const [listFilters, setListFilters] = useState<MemberAssignedListFilters>(
    () => initialFilters ?? EMPTY_MEMBER_ASSIGNED_FILTERS
  );

  useEffect(() => {
    if (initialFilters && hasActiveMemberAssignedFilters(initialFilters)) {
      setListFilters(initialFilters);
      if (initialFilters.status === 'terminee') {
        setShowClosed(true);
        setOpenGroups({
          todo: false,
          en_cours: false,
          en_retard: false,
          terminee: true,
        });
      }
    }
  }, [initialFilters]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    if (initialFilters?.status === 'terminee') {
      return {
        todo: false,
        en_cours: false,
        en_retard: false,
        terminee: true,
      };
    }
    return Object.fromEntries(KANBAN_WORKFLOW_COLUMNS.map((c) => [c.id, true]));
  });

  const visibleColumns = useMemo(
    () => getOrderedVisibleColumns(columnVisibility),
    [columnVisibility]
  );

  const tableColSpan = 1 + visibleColumns.length;

  const handleVisibilityChange = useCallback(
    (next: MemberAssignedColumnVisibility) => {
      setColumnVisibility(next);
      saveMemberAssignedColumnVisibility(next);
    },
    []
  );

  const filtered = useMemo(
    () =>
      filterMemberAssignedTaskList(tasks, listFilters, {
        searchQuery,
        hideCompleted: !showClosed,
      }),
    [tasks, listFilters, searchQuery, showClosed]
  );

  /** Group filtered tasks by status; hide empty sections. */
  const visibleGroups = useMemo(() => {
    const groups = groupMemberAssignedTasksByStatus(filtered);
    const statusFilter = listFilters.status;
    const mayShowEmptyTodo =
      onAddTask != null &&
      (statusFilter == null ||
        statusFilter === 'todo' ||
        listFilters.allStatuses);
    if (mayShowEmptyTodo && !groups.some((g) => g.id === 'todo')) {
      const todoCol = KANBAN_WORKFLOW_COLUMNS.find((c) => c.id === 'todo');
      if (todoCol) {
        return [
          { id: 'todo' as const, label: todoCol.label, tasks: [] },
          ...groups,
        ];
      }
    }
    return groups;
  }, [filtered, listFilters.status, listFilters.allStatuses, onAddTask]);

  useEffect(() => {
    if (!expandTodoGroup) return;
    setOpenGroups((prev) => ({ ...prev, todo: true }));
    onTodoGroupExpanded?.();
  }, [expandTodoGroup, onTodoGroupExpanded]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="member-assigned-page">
      <div className="member-assigned-main">
        <div className="member-assigned-card">
          <MemberTasksPageCardHeader currentLabel="Assigné à moi" />
          <div className="member-assigned-toolbar">
            <div className="member-assigned-toolbar-left">
              <button
                type="button"
                className="member-assigned-tool member-assigned-tool--active"
              >
                <Layers size={15} strokeWidth={2} aria-hidden />
                <span>
                  <span className="member-assigned-tool-muted">Groupe:</span> Statut
                </span>
              </button>
              <button
                type="button"
                className={`member-assigned-tool ${columnsPanelOpen ? 'member-assigned-tool--active' : ''}`}
                onClick={() => setColumnsPanelOpen((v) => !v)}
                aria-expanded={columnsPanelOpen}
              >
                <Columns3 size={15} strokeWidth={2} aria-hidden />
                Colonnes
              </button>
            </div>
            <div className="member-assigned-toolbar-right">
              <MemberAssignedFilterMenu
                filters={listFilters}
                onFiltersChange={setListFilters}
              />
              <button
                type="button"
                className={`member-assigned-tool ${showClosed ? 'member-assigned-tool--active-soft' : ''}`}
                onClick={() => setShowClosed((v) => !v)}
              >
                Fermé
              </button>
              {showSearch ? (
                <div className="member-assigned-search">
                  <Search size={14} aria-hidden />
                  <input
                    type="search"
                    placeholder="Rechercher…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className="member-assigned-icon-btn"
                  aria-label="Rechercher"
                  onClick={() => setShowSearch(true)}
                >
                  <Search size={16} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>

          <div className="member-assigned-body">
            {loading ? (
              <p className="member-assigned-loading">Chargement…</p>
            ) : (
              <>
                {visibleGroups.map((group) => {
                  const isOpen = openGroups[group.id] !== false;
                  const pillClass = memberStatusPillClass(
                    kanbanColumnToPillTone(group.id)
                  );

                  return (
                    <div key={group.id} className="member-assigned-group">
                      <button
                        type="button"
                        className="member-assigned-group-header"
                        onClick={() => toggleGroup(group.id)}
                        aria-expanded={isOpen}
                      >
                        <span className="member-assigned-group-chevron" aria-hidden>
                          {isOpen ? (
                            <ChevronDown size={14} strokeWidth={2.5} />
                          ) : (
                            <ChevronRight size={14} strokeWidth={2.5} />
                          )}
                        </span>
                        <span className={pillClass}>{group.label}</span>
                        <span className="member-assigned-group-count">
                          {group.tasks.length}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="member-assigned-table-wrap">
                          <table
                            className="member-assigned-table"
                            key={visibleColumns.join(',')}
                          >
                            <thead>
                              <tr>
                                <th
                                  className="member-assigned-th-check"
                                  scope="col"
                                />
                                {visibleColumns.map((colKey) => (
                                  <th
                                    key={colKey}
                                    scope="col"
                                    className={`member-assigned-th-data member-assigned-th-${colKey}`}
                                    title={MEMBER_ASSIGNED_COLUMN_LABELS[colKey]}
                                  >
                                    {TABLE_HEADER_SHORT[colKey] ??
                                      MEMBER_ASSIGNED_COLUMN_LABELS[colKey]}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {group.tasks.map((t) => {
                                const isDone =
                                  normalizeTaskStatutKey(t.statut_t) === 'terminee';
                                return (
                                  <tr
                                    key={t.id_tache}
                                    className={`member-assigned-tr ${isDone ? 'is-done' : ''}`}
                                    onClick={() =>
                                      navigate(appPaths.task(t.id_tache))
                                    }
                                  >
                                    <td
                                      className="member-assigned-td-check"
                                      onClick={stopRow}
                                      onMouseDown={stopRow}
                                    >
                                      <button
                                        type="button"
                                        className={`member-assigned-checkbox ${isDone ? 'is-checked' : ''}`}
                                        aria-label={
                                          isDone
                                            ? 'Marquer comme non terminée'
                                            : 'Marquer comme terminée'
                                        }
                                        onClick={(e) => void onToggleCheck(t, e)}
                                      />
                                    </td>
                                    {visibleColumns.map((colKey) => (
                                      <td
                                        key={colKey}
                                        className={columnCellClass(colKey)}
                                        onClick={
                                          colKey === 'priority' ? stopRow : undefined
                                        }
                                        onMouseDown={
                                          colKey === 'priority' ? stopRow : undefined
                                        }
                                      >
                                        {renderColumnCell(
                                          colKey,
                                          t,
                                          isDone,
                                          onPriorityChange
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                );
                              })}
                              {group.id === 'todo' && onAddTask && (
                                <tr className="member-assigned-tr-add">
                                  <td colSpan={tableColSpan}>
                                    <button
                                      type="button"
                                      className="member-assigned-add-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onAddTask();
                                      }}
                                    >
                                      <Plus
                                        size={14}
                                        strokeWidth={2.5}
                                        aria-hidden
                                      />
                                      Ajouter Tâche
                                    </button>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}

                {!loading && filtered.length === 0 && visibleGroups.length === 0 && (
                  <p className="member-assigned-empty">
                    Aucune tâche assignée pour le moment.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <MemberAssignedColumnsPanel
        open={columnsPanelOpen}
        visibility={columnVisibility}
        onVisibilityChange={handleVisibilityChange}
        onClose={() => setColumnsPanelOpen(false)}
      />
    </div>
  );
};

export default MemberAssignedTasksView;
