import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appPaths } from '../lib/workspaceRoutes';
import {
  ChevronDown,
  ChevronRight,
  Columns3,
  MoreHorizontal,
  Plus,
  Search,
  X,
  Calendar,
  Flag,
  Circle,
} from 'lucide-react';
import { hierarchyService } from '../services/hierarchy.service';
import type { ListStatusPM } from '../types/hierarchy';
import {
  TASK_PRIORITY_LABELS,
  TaskPriority,
  type Tache,
} from '../types/task';
import type { HierarchyParentContext } from './CreateHierarchyItemModal';
import {
  FALLBACK_LIST_STATUSES,
  normalizeTaskStatutKey,
  taskMatchesStatusGroup,
} from '../lib/listStatusGroups';
import { getStatusLabel, getStatusTone, type StatusTone } from '../lib/listStatusStyles';
import {
  memberStatusPillClass,
  memberWorkflowStatusLabel,
  statutKeyToPillTone,
  memberPriorityTextClass,
  memberListPriorityLabel,
  memberListPriorityValue,
  MEMBER_LIST_PRIORITY_OPTIONS,
  taskPriorityToPillTone,
} from '../lib/memberStatusPill';
import '../styles/memberStatusPill.css';
import './ListStatusGroupedView.css';

export type TaskFieldPatch = Partial<{
  priorite_t: TaskPriority;
  assigne_a: number | null;
  date_limite_t: string | null;
}>;

/** ClickUp list view — group order in main content */
const CLICKUP_STATUS_KEYS = [
  'en_cours',
  'todo',
  'en_retard',
  'terminee',
] as const;

const CLICKUP_STATUS_LABELS: Record<string, string> = {
  todo: 'À FAIRE',
  en_cours: 'EN COURS',
  en_retard: 'EN RETARD',
  terminee: 'TERMINÉ',
};

export interface ListStatusGroupedViewProps {
  variant?: 'default' | 'clickup';
  /** Member list pages — colored status pills instead of dot + plain text. */
  memberStatusBadges?: boolean;
  listId: number;
  listName: string;
  tasks: Tache[];
  searchQuery?: string;
  /** When false, hide TERMINÉ / closed status group */
  showClosed?: boolean;
  visibleColumns?: Partial<Record<ColumnKey, boolean>>;
  parentCtx: HierarchyParentContext;
  canCreateTask: boolean;
  highlightTaskId?: number | null;
  onAddTask: (parent: HierarchyParentContext, statutKey: string) => void;
  /** Optional callback after navigating to /tasks/:id */
  onTaskClick?: (task: Tache) => void;
  /** When true (default), row click navigates to task details page */
  navigateOnRowClick?: boolean;
  onStatusesChange?: () => void;
  canEditStatus?: boolean;
  /** Member list — per-task status edit (change_task_status / change_own_task_status). */
  canEditStatusFor?: (task: Tache) => boolean;
  canEditFields?: boolean;
  assigneeOptions?: { id: number; label: string }[];
  projectMembers?: { id: number; label: string }[];
  onTaskFieldChange?: (taskId: number, patch: TaskFieldPatch) => void | Promise<void>;
  onTaskStatusChange?: (taskId: number, statutKey: string) => void | Promise<void>;
  savingStatusTaskId?: number | null;
}

type ColumnKey =
  | 'checkbox'
  | 'name'
  | 'description'
  | 'assignee'
  | 'dueDate'
  | 'status'
  | 'priority';

const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'checkbox', label: '' },
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'assignee', label: 'Assigned Users' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
];

const CLICKUP_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'checkbox', label: '' },
  { key: 'name', label: 'Nom' },
  { key: 'assignee', label: 'Assigné' },
  { key: 'dueDate', label: "Date d'échéance" },
  { key: 'priority', label: 'Priorité' },
  { key: 'status', label: 'Statut' },
];

const DEFAULT_VISIBLE: Record<ColumnKey, boolean> = {
  checkbox: true,
  name: true,
  description: true,
  assignee: true,
  dueDate: true,
  status: true,
  priority: true,
};

const CLICKUP_VISIBLE: Record<ColumnKey, boolean> = {
  checkbox: true,
  name: true,
  description: false,
  assignee: true,
  dueDate: true,
  status: true,
  priority: true,
};

function formatDueDate(raw?: string | null) {
  if (!raw) return '—';
  try {
    return new Date(raw).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function assigneeLabel(t: Tache) {
  if (!t.utilisateur) return '—';
  const name =
    `${t.utilisateur.prenom || ''} ${t.utilisateur.nom || ''}`.trim();
  return name || t.utilisateur.email || '—';
}

function assigneeInitials(t: Tache) {
  const label = assigneeLabel(t);
  if (label === '—') return '?';
  const parts = label.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface StatusBadgeSelectProps {
  task: Tache;
  statuses: ListStatusPM[];
  canEdit: boolean;
  saving?: boolean;
  memberPills?: boolean;
  onChange: (statutKey: string) => void;
}

const StatusBadgeSelect: React.FC<StatusBadgeSelectProps> = ({
  task,
  statuses,
  canEdit,
  saving,
  memberPills = false,
  onChange,
}) => {
  const currentKey = normalizeTaskStatutKey(task.statut_t);
  const tone = getStatusTone(currentKey);
  const label = getStatusLabel(currentKey, statuses);
  const pillTone = statutKeyToPillTone(currentKey);
  const pillLabel = memberWorkflowStatusLabel(currentKey);

  const options = useMemo(() => {
    if (memberPills) {
      return CLICKUP_STATUS_KEYS.map((key) => ({
        id_status: -1,
        id_list: task.id_list ?? 0,
        label: memberWorkflowStatusLabel(key),
        statut_key: key,
        position: -1,
      }));
    }
    const list = [...statuses];
    if (!list.some((s) => s.statut_key === currentKey)) {
      list.unshift({
        id_status: -1,
        id_list: task.id_list ?? 0,
        label,
        statut_key: currentKey,
        position: -1,
      });
    }
    return list;
  }, [statuses, currentKey, label, task.id_list, memberPills]);

  if (memberPills) {
    if (!canEdit) {
      return (
        <span className={memberStatusPillClass(pillTone)}>{pillLabel}</span>
      );
    }

    return (
      <div
        className="member-status-select-wrap"
        onClick={(e) => e.stopPropagation()}
      >
        <span className={memberStatusPillClass(pillTone)}>{pillLabel}</span>
        <select
          className="member-status-select-native"
          value={currentKey}
          disabled={saving}
          onChange={(e) => {
            e.stopPropagation();
            onChange(e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Statut : ${pillLabel}`}
        >
          {options.map((s) => (
            <option key={s.statut_key} value={s.statut_key}>
              {memberWorkflowStatusLabel(s.statut_key)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <span className={`status-badge status-badge--${tone}`}>{label}</span>
    );
  }

  return (
    <div
      className="status-badge-select-wrap"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <select
        className={`status-badge-select status-badge--${tone}`}
        value={currentKey}
        disabled={saving}
        onChange={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onChange(e.target.value);
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Statut : ${label}`}
      >
        {options.map((s) => (
          <option key={s.statut_key} value={s.statut_key}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
};

interface PriorityBadgeSelectProps {
  task: Tache;
  canEdit: boolean;
  memberPills?: boolean;
  clickUpVariant?: boolean;
  onChange: (priority: TaskPriority) => void;
}

const PriorityBadgeSelect: React.FC<PriorityBadgeSelectProps> = ({
  task,
  canEdit,
  memberPills = false,
  clickUpVariant = false,
  onChange,
}) => {
  const priorityValue = memberPills
    ? memberListPriorityValue(task.priorite_t)
    : (task.priorite_t ?? TaskPriority.MEDIUM);
  const tone = taskPriorityToPillTone(priorityValue);
  const label = memberPills
    ? memberListPriorityLabel(task.priorite_t)
    : (TASK_PRIORITY_LABELS[task.priorite_t] ?? task.priorite_t ?? '—');

  if (memberPills) {
    const textClass = memberPriorityTextClass(tone);

    if (!canEdit) {
      return <span className={textClass}>{label}</span>;
    }

    return (
      <div
        className="member-priority-text-select"
        onClick={(e) => e.stopPropagation()}
      >
        <span className={textClass}>{label}</span>
        <select
          className="member-priority-text-select-native"
          value={priorityValue}
          aria-label={`Priorité : ${label}`}
          onChange={(e) => {
            e.stopPropagation();
            onChange(e.target.value as TaskPriority);
          }}
        >
          {MEMBER_LIST_PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <span className="list-status-priority">
        {clickUpVariant && <Flag size={13} aria-hidden />}
        {label}
      </span>
    );
  }

  return (
    <select
      className="list-status-inline-select"
      value={priorityValue}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange(e.target.value as TaskPriority);
      }}
    >
      {Object.entries(TASK_PRIORITY_LABELS).map(([k, optLabel]) => (
        <option key={k} value={k}>
          {optLabel}
        </option>
      ))}
    </select>
  );
};

interface StatusTaskTableProps {
  tasks: Tache[];
  allStatuses: ListStatusPM[];
  clickUpVariant?: boolean;
  memberStatusBadges?: boolean;
  externalSearchQuery?: string;
  visibleColumns?: Partial<Record<ColumnKey, boolean>>;
  canCreateTask: boolean;
  canEditStatus: boolean;
  canEditStatusFor?: (task: Tache) => boolean;
  canEditFields: boolean;
  assigneeOptions: { id: number; label: string }[];
  highlightTaskId?: number | null;
  savingStatusTaskId?: number | null;
  onAddTask: () => void;
  /** Optional callback after navigating to /tasks/:id */
  onTaskClick?: (task: Tache) => void;
  /** When true (default), row click navigates to task details page */
  navigateOnRowClick?: boolean;
  onTaskFieldChange?: (taskId: number, patch: TaskFieldPatch) => void | Promise<void>;
  onTaskStatusChange?: (taskId: number, statutKey: string) => void | Promise<void>;
}

const stopInteractive = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

const StatusTaskTable: React.FC<StatusTaskTableProps> = ({
  tasks,
  allStatuses,
  clickUpVariant = false,
  memberStatusBadges = false,
  canCreateTask,
  canEditStatus,
  canEditStatusFor,
  canEditFields,
  assigneeOptions,
  highlightTaskId,
  savingStatusTaskId,
  onAddTask,
  onTaskClick,
  navigateOnRowClick = true,
  onTaskFieldChange,
  onTaskStatusChange,
  externalSearchQuery,
  visibleColumns: visibleColumnsProp,
}) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');
  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>(
    () => ({
      ...(clickUpVariant ? CLICKUP_VISIBLE : DEFAULT_VISIBLE),
      ...visibleColumnsProp,
    })
  );
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (!visibleColumnsProp) return;
    setVisibleCols((prev) => ({ ...prev, ...visibleColumnsProp }));
  }, [visibleColumnsProp]);

  const searchText =
    externalSearchQuery !== undefined ? externalSearchQuery : filter;

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => {
      const name = (t.nom_t || '').toLowerCase();
      const desc = (t.description_t || '').toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [tasks, searchText]);

  const columnDefs = clickUpVariant ? CLICKUP_COLUMNS : ALL_COLUMNS;
  const visibleColumnList = columnDefs.filter((c) => visibleCols[c.key]);

  const toggleCol = (key: ColumnKey) => {
    if (key === 'checkbox' || key === 'name') return;
    setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTaskRowClick = (task: Tache) => {
    if (navigateOnRowClick) {
      navigate(`/tasks/${task.id_tache}`);
    }
    onTaskClick?.(task);
  };

  const interactiveColumns = new Set<ColumnKey>([
    'checkbox',
    'assignee',
    'dueDate',
    'status',
    'priority',
  ]);

  const renderTaskCell = (colKey: ColumnKey, t: Tache): React.ReactNode => {
    switch (colKey) {
      case 'checkbox':
        return clickUpVariant ? (
          <span className="list-status-task-circle" aria-hidden>
            <Circle size={14} strokeWidth={1.75} />
          </span>
        ) : (
          <input
            type="checkbox"
            checked={selected.has(t.id_tache)}
            onMouseDown={stopInteractive}
            onClick={stopInteractive}
            onChange={() => toggleSelect(t.id_tache)}
            aria-label={`Select ${t.nom_t}`}
          />
        );
      case 'name':
        return (
          <span className="list-status-task-name-cell">{t.nom_t}</span>
        );
      case 'description':
        return (
          <span className="list-status-cell-muted">
            {t.description_t?.trim() || '—'}
          </span>
        );
      case 'assignee':
        return canEditFields && assigneeOptions.length > 0 ? (
          <select
            className="list-status-inline-select"
            value={t.assigne_a ?? ''}
            onMouseDown={stopInteractive}
            onClick={stopInteractive}
            onChange={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const v = e.target.value;
              void onTaskFieldChange?.(t.id_tache, {
                assigne_a: v ? Number(v) : null,
              });
            }}
          >
            <option value="">—</option>
            {assigneeOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        ) : t.utilisateur ? (
          <span className="list-status-assignee">
            <span className="list-status-assignee-avatar">
              {assigneeInitials(t)}
            </span>
            <span>{assigneeLabel(t)}</span>
          </span>
        ) : (
          <span className="list-status-cell-muted">—</span>
        );
      case 'dueDate':
        return canEditFields ? (
          <input
            type="date"
            className="list-status-inline-date"
            onMouseDown={stopInteractive}
            onClick={stopInteractive}
            value={
              t.date_limite_t ? String(t.date_limite_t).slice(0, 10) : ''
            }
            onChange={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void onTaskFieldChange?.(t.id_tache, {
                date_limite_t: e.target.value || null,
              });
            }}
          />
        ) : (
          <span className="list-status-due-cell">
            {clickUpVariant && <Calendar size={13} aria-hidden />}
            {formatDueDate(t.date_limite_t)}
          </span>
        );
      case 'priority':
        return (
          <PriorityBadgeSelect
            task={t}
            canEdit={canEditFields}
            memberPills={memberStatusBadges}
            clickUpVariant={clickUpVariant}
            onChange={(prio) =>
              void onTaskFieldChange?.(t.id_tache, { priorite_t: prio })
            }
          />
        );
      case 'status': {
        const statusEditable = canEditStatusFor
          ? canEditStatusFor(t)
          : canEditStatus;
        return (
          <StatusBadgeSelect
            task={t}
            statuses={allStatuses}
            canEdit={statusEditable}
            saving={savingStatusTaskId === t.id_tache}
            memberPills={memberStatusBadges}
            onChange={(key) => void onTaskStatusChange?.(t.id_tache, key)}
          />
        );
      }
      default:
        return null;
    }
  };

  return (
    <div
      className={`list-status-table-panel${clickUpVariant ? ' list-status-table-panel--clickup' : ''}`}
    >
      {!clickUpVariant && (
        <div className="list-status-table-toolbar">
          <div className="list-status-table-search">
            <Search size={14} aria-hidden />
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter task names..."
              aria-label="Filter task names"
            />
          </div>
          <div className="list-status-table-toolbar-right">
            <div className="list-status-columns-wrap">
              <button
                type="button"
                className={`list-status-columns-btn ${columnsOpen ? 'is-open' : ''}`}
                onClick={() => setColumnsOpen((v) => !v)}
              >
                <Columns3 size={14} />
                Columns
              </button>
              {columnsOpen && (
                <>
                  <div
                    className="list-status-columns-backdrop"
                    role="presentation"
                    onClick={() => setColumnsOpen(false)}
                  />
                  <div className="list-status-columns-popover" role="menu">
                    {ALL_COLUMNS.filter((c) => c.key !== 'checkbox').map((col) => (
                      <label key={col.key} className="list-status-columns-item">
                        <input
                          type="checkbox"
                          checked={visibleCols[col.key]}
                          disabled={col.key === 'name'}
                          onChange={() => toggleCol(col.key)}
                        />
                        <span>{col.label || col.key}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="list-status-table-wrap">
        <table className="list-status-table">
          <thead>
            <tr>
              {visibleColumnList.map((col) => (
                <th key={col.key} className={`col-${col.key}`}>
                  {col.key === 'checkbox' ? (
                    <span className="list-status-th-check" aria-hidden />
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id_tache}
                className={
                  highlightTaskId === t.id_tache
                    ? 'list-status-tr is-highlighted'
                    : 'list-status-tr'
                }
                onClick={() => handleTaskRowClick(t)}
                style={{ cursor: 'pointer' }}
              >
                {visibleColumnList.map((col) => {
                  const interactive = interactiveColumns.has(col.key);
                  const memberCellNoPrevent =
                    memberStatusBadges &&
                    (col.key === 'priority' || col.key === 'status');
                  const cellStop = memberCellNoPrevent
                    ? (e: React.MouseEvent) => e.stopPropagation()
                    : stopInteractive;
                  return (
                    <td
                      key={col.key}
                      className={`col-${col.key}`}
                      onMouseDown={interactive ? cellStop : undefined}
                      onClick={interactive ? cellStop : undefined}
                    >
                      {renderTaskCell(col.key, t)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {canCreateTask && (
              <tr className="list-status-tr-add">
                <td colSpan={visibleColumnList.length}>
                  <button
                    type="button"
                    className="list-status-add-new-task"
                    onClick={onAddTask}
                  >
                    <Plus size={14} />
                    {clickUpVariant ? 'Ajouter Tâche' : '+ Add new task'}
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ListStatusGroupedView: React.FC<ListStatusGroupedViewProps> = ({
  variant = 'default',
  memberStatusBadges = false,
  listId,
  listName,
  tasks,
  searchQuery = '',
  showClosed = true,
  visibleColumns,
  parentCtx,
  canCreateTask,
  highlightTaskId,
  onAddTask,
  onTaskClick,
  navigateOnRowClick = true,
  onStatusesChange,
  canEditStatus = false,
  canEditStatusFor,
  canEditFields = false,
  assigneeOptions = [],
  projectMembers = [],
  onTaskFieldChange,
  onTaskStatusChange,
  savingStatusTaskId,
}) => {
  const [statuses, setStatuses] = useState<ListStatusPM[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const memberOptions = useMemo(() => {
    if (assigneeOptions.length > 0) return assigneeOptions;
    return projectMembers;
  }, [assigneeOptions, projectMembers]);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [addingStatus, setAddingStatus] = useState(false);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [statusError, setStatusError] = useState('');
  const isClickUp = variant === 'clickup';

  const displayTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => {
      const name = (t.nom_t || '').toLowerCase();
      const desc = (t.description_t || '').toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [tasks, searchQuery]);

  const loadStatuses = useCallback(async () => {
    try {
      const rows = await hierarchyService.getListStatuses(listId);
      setStatuses(rows);
    } catch {
      setStatuses(
        FALLBACK_LIST_STATUSES.map((s, i) => ({
          ...s,
          id_status: -(i + 1),
          id_list: listId,
        }))
      );
    }
  }, [listId]);

  useEffect(() => {
    void loadStatuses();
  }, [loadStatuses]);

  const displayStatuses = useMemo(() => {
    if (!isClickUp) return statuses;
    const filtered = statuses.filter((s) =>
      CLICKUP_STATUS_KEYS.includes(s.statut_key as (typeof CLICKUP_STATUS_KEYS)[number])
    );
    const ordered = CLICKUP_STATUS_KEYS.map((key) =>
      filtered.find((s) => s.statut_key === key)
    ).filter(Boolean) as ListStatusPM[];
    let result = ordered.length > 0 ? ordered : filtered;
    if (!showClosed) {
      result = result.filter((s) => s.statut_key !== 'terminee');
    }
    return result;
  }, [statuses, isClickUp, showClosed]);

  useEffect(() => {
    if (displayStatuses.length > 0) {
      if (isClickUp) {
        setExpanded(new Set(displayStatuses.map((s) => s.statut_key)));
      } else {
        const todo = displayStatuses.find((s) => /todo|faire/i.test(s.label));
        const initial = todo ? [todo.statut_key] : [displayStatuses[0].statut_key];
        setExpanded(new Set(initial));
      }
    }
  }, [displayStatuses, isClickUp]);

  const tasksByStatus = useMemo(() => {
    const map = new Map<string, Tache[]>();
    for (const s of displayStatuses) {
      map.set(s.statut_key, []);
    }
    for (const t of displayTasks) {
      let placed = false;
      for (const s of displayStatuses) {
        if (taskMatchesStatusGroup(t, s.statut_key)) {
          map.get(s.statut_key)!.push(t);
          placed = true;
          break;
        }
      }
      if (!placed && displayStatuses[0]) {
        map.get(displayStatuses[0].statut_key)!.push(t);
      }
    }
    return map;
  }, [displayTasks, displayStatuses]);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAddStatus = async () => {
    const label = newStatusLabel.trim();
    if (!label) {
      setStatusError('Entrez un nom de statut');
      return;
    }
    setStatusError('');
    try {
      const created = await hierarchyService.createListStatus(listId, label);
      setStatuses((prev) =>
        [...prev, created].sort((a, b) => a.position - b.position)
      );
      setExpanded((prev) => new Set(prev).add(created.statut_key));
      setNewStatusLabel('');
      setAddingStatus(false);
      onStatusesChange?.();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setStatusError(
        ax?.response?.data?.message || 'Impossible de créer le statut'
      );
    }
  };

  return (
    <div
      className={`list-status-view${isClickUp ? ' list-status-view--clickup' : ''}${
        memberStatusBadges ? ' list-status-view--member-badges' : ''
      }`}
    >
      <h1 className="list-status-view-title">{listName}</h1>

      <div className="list-status-groups">
        {displayStatuses.map((status) => {
          const key = status.statut_key;
          const open = expanded.has(key);
          const groupTasks = tasksByStatus.get(key) ?? [];
          const menuOpen = openMenuKey === key;

          const tone: StatusTone = getStatusTone(key);

          return (
            <div
              key={key}
              className={`list-status-group ${open ? 'is-open' : ''}`}
              data-tone={tone}
            >
              <div className="list-status-group-header">
                <button
                  type="button"
                  className="list-status-chevron"
                  aria-expanded={open}
                  onClick={() => toggleExpand(key)}
                >
                  {open ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </button>
                {memberStatusBadges ? (
                  <button
                    type="button"
                    className="list-status-group-title-btn"
                    onClick={() => toggleExpand(key)}
                  >
                    <span className={memberStatusPillClass(statutKeyToPillTone(key))}>
                      {isClickUp
                        ? CLICKUP_STATUS_LABELS[key] ?? status.label.toUpperCase()
                        : status.label.toUpperCase()}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="list-status-name"
                    onClick={() => toggleExpand(key)}
                  >
                    {isClickUp
                      ? CLICKUP_STATUS_LABELS[key] ?? status.label.toUpperCase()
                      : status.label}
                  </button>
                )}
                <span className="list-status-count">{groupTasks.length}</span>
                <div className="list-status-header-spacer" />
                <div className="list-status-header-actions">
                  <button
                    type="button"
                    className={`list-status-menu-btn ${menuOpen ? 'is-open' : ''}`}
                    aria-label="Options du statut"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuKey(menuOpen ? null : key);
                    }}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {menuOpen && (
                    <div
                      className="list-status-menu-popover"
                      role="menu"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setOpenMenuKey(null);
                          toggleExpand(key);
                        }}
                      >
                        {open ? 'Collapse' : 'Expand'}
                      </button>
                    </div>
                  )}
                  {canCreateTask && !isClickUp && (
                    <button
                      type="button"
                      className="list-status-add-task"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!open) toggleExpand(key);
                        onAddTask(parentCtx, key);
                      }}
                    >
                      <Plus size={14} />
                      + Add task
                    </button>
                  )}
                </div>
              </div>

              {open && (
                <StatusTaskTable
                  tasks={groupTasks}
                  allStatuses={displayStatuses}
                  clickUpVariant={isClickUp}
                  memberStatusBadges={memberStatusBadges}
                  canCreateTask={canCreateTask}
                  canEditStatus={canEditStatus}
                  canEditStatusFor={canEditStatusFor}
                  canEditFields={canEditFields}
                  assigneeOptions={memberOptions}
                  highlightTaskId={highlightTaskId}
                  savingStatusTaskId={savingStatusTaskId}
                  onAddTask={() => onAddTask(parentCtx, key)}
                  onTaskClick={onTaskClick}
                  navigateOnRowClick={navigateOnRowClick}
                  onTaskFieldChange={onTaskFieldChange}
                  onTaskStatusChange={onTaskStatusChange}
                  externalSearchQuery={searchQuery}
                  visibleColumns={visibleColumns}
                />
              )}
            </div>
          );
        })}
      </div>

      {canCreateTask && !isClickUp && (
        <div className="list-status-add-new">
          {!addingStatus ? (
            <button
              type="button"
              className="list-status-add-new-btn"
              onClick={() => {
                setAddingStatus(true);
                setStatusError('');
              }}
            >
              <Plus size={14} />
              Add New Status
            </button>
          ) : (
            <div className="list-status-add-new-form">
              <input
                type="text"
                value={newStatusLabel}
                onChange={(e) => setNewStatusLabel(e.target.value)}
                placeholder="Nom du statut"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleAddStatus();
                  if (e.key === 'Escape') {
                    setAddingStatus(false);
                    setNewStatusLabel('');
                  }
                }}
              />
              <button
                type="button"
                className="list-status-add-new-save"
                onClick={() => void handleAddStatus()}
              >
                Ajouter
              </button>
              <button
                type="button"
                className="list-status-add-new-cancel"
                aria-label="Annuler"
                onClick={() => {
                  setAddingStatus(false);
                  setNewStatusLabel('');
                  setStatusError('');
                }}
              >
                <X size={16} />
              </button>
              {statusError && (
                <p className="list-status-add-new-error">{statusError}</p>
              )}
            </div>
          )}
        </div>
      )}

      {openMenuKey && (
        <div
          className="list-status-menu-backdrop"
          role="presentation"
          onClick={() => setOpenMenuKey(null)}
        />
      )}
    </div>
  );
};

export default ListStatusGroupedView;
