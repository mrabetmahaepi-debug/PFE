import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Plus } from 'lucide-react';
import { useListPageContext } from './listPageContext';
import { appPaths } from '../lib/workspaceRoutes';
import { normalizeTaskStatutKey } from '../lib/listStatusGroups';
import { getStatusTone, type StatusTone } from '../lib/listStatusStyles';
import {
  TASK_PRIORITY_LABELS,
  TaskPriority,
  type Tache,
} from '../types/task';
import './TableurTaskView.css';

const TABLEUR_STATUS_OPTIONS: { key: string; label: string; tone: StatusTone }[] = [
  { key: 'todo', label: 'À FAIRE', tone: 'gray' },
  { key: 'en_cours', label: 'EN COURS', tone: 'blue' },
  { key: 'en_retard', label: 'EN RETARD', tone: 'orange' },
  { key: 'terminee', label: 'TERMINÉ', tone: 'green' },
  { key: 'bloquee', label: 'BLOQUÉ', tone: 'red' },
  { key: 'en_revision', label: 'EN REVISION', tone: 'purple' },
];

function tableurStatusLabel(key: string): string {
  const k = normalizeTaskStatutKey(key);
  return TABLEUR_STATUS_OPTIONS.find((o) => o.key === k)?.label ?? k.toUpperCase();
}

function assigneeLabel(t: Tache): string {
  if (!t.utilisateur) return '';
  const name =
    `${t.utilisateur.prenom || ''} ${t.utilisateur.nom || ''}`.trim();
  return name || t.utilisateur.email || '';
}

function assigneeInitials(t: Tache): string {
  const label = assigneeLabel(t);
  if (!label) return '?';
  const parts = label.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDueDate(raw?: string | null): string {
  if (!raw) return '';
  try {
    return new Date(raw).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function stopRow(e: React.MouseEvent) {
  e.stopPropagation();
}

interface TableurStatusDropdownProps {
  task: Tache;
  canEdit: boolean;
  saving: boolean;
  onChange: (statutKey: string) => void;
}

const TableurStatusDropdown: React.FC<TableurStatusDropdownProps> = ({
  task,
  canEdit,
  saving,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const currentKey = normalizeTaskStatutKey(task.statut_t);
  const tone = getStatusTone(currentKey);
  const label = tableurStatusLabel(currentKey);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!canEdit) {
    return (
      <span className={`cu-tableur-status-badge cu-tableur-status-badge--${tone}`}>
        {label}
      </span>
    );
  }

  return (
    <div className="cu-tableur-status-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`cu-tableur-status-badge cu-tableur-status-badge--${tone}`}
        disabled={saving}
        onClick={(e) => {
          stopRow(e);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {label}
        <ChevronDown size={12} aria-hidden />
      </button>
      {open && (
        <div className="cu-tableur-status-menu" role="listbox">
          {TABLEUR_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="option"
              aria-selected={opt.key === currentKey}
              className={`cu-tableur-status-option ${
                opt.key === currentKey ? 'cu-tableur-status-option--active' : ''
              }`}
              onClick={(e) => {
                stopRow(e);
                setOpen(false);
                if (opt.key !== currentKey) onChange(opt.key);
              }}
            >
              <span
                className={`cu-tableur-status-option-dot cu-tableur-status-option-dot--${opt.tone}`}
                aria-hidden
              />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export interface TableurTaskViewProps {
  listId: number;
}

const TableurTaskView: React.FC<TableurTaskViewProps> = ({ listId }) => {
  const navigate = useNavigate();
  const {
    tasks,
    canCreateTask,
    canEditTask,
    highlightTaskId,
    onOpenCreateTask,
    onTaskClick,
    assigneeOptions,
    onTaskFieldChange,
    onTaskStatusChange,
    savingStatusTaskId,
  } = useListPageContext(listId);

  const [selected, setSelected] = useState<Set<number>>(() => new Set());

  const listTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.id_list == null || Number(t.id_list) === listId)
        .slice()
        .sort((a, b) => a.id_tache - b.id_tache),
    [tasks, listId]
  );

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNameClick = (task: Tache) => {
    if (onTaskClick) {
      onTaskClick(task);
      return;
    }
    navigate(appPaths.task(task.id_tache));
  };

  const priorityClass = (p?: string) => {
    const u = String(p ?? '').toUpperCase();
    if (u === 'URGENT') return 'cu-tableur-priority--urgent';
    if (u === 'HIGH') return 'cu-tableur-priority--high';
    return '';
  };

  return (
    <div className="cu-tableur-view">
      <div className="cu-tableur-scroll">
        <table className="cu-tableur-table">
          <thead>
            <tr>
              <th className="cu-tableur-col-check" scope="col" />
              <th className="cu-tableur-col-num" scope="col">
                #
              </th>
              <th className="cu-tableur-col-name" scope="col">
                Name
              </th>
              <th className="cu-tableur-col-assignee" scope="col">
                Assigné
              </th>
              <th className="cu-tableur-col-status" scope="col">
                Statut
              </th>
              <th className="cu-tableur-col-due" scope="col">
                Date d&apos;échéance
              </th>
              <th className="cu-tableur-col-priority" scope="col">
                Priorité
              </th>
            </tr>
          </thead>
          <tbody>
            {listTasks.map((t, index) => (
              <tr
                key={t.id_tache}
                className={
                  highlightTaskId === t.id_tache
                    ? 'cu-tableur-row--highlight'
                    : undefined
                }
              >
                <td
                  className="cu-tableur-col-check"
                  onClick={stopRow}
                  onMouseDown={stopRow}
                >
                  <input
                    type="checkbox"
                    className="cu-tableur-check"
                    checked={selected.has(t.id_tache)}
                    onChange={() => toggleSelect(t.id_tache)}
                    aria-label={`Sélectionner ${t.nom_t}`}
                  />
                </td>
                <td className="cu-tableur-col-num">{index + 1}</td>
                <td className="cu-tableur-col-name">
                  <button
                    type="button"
                    className="cu-tableur-name-btn"
                    onClick={() => handleNameClick(t)}
                    title={t.nom_t}
                  >
                    {t.nom_t}
                  </button>
                </td>
                <td
                  className="cu-tableur-col-assignee"
                  onClick={stopRow}
                  onMouseDown={stopRow}
                >
                  {canEditTask && assigneeOptions.length > 0 ? (
                    <select
                      className="cu-tableur-inline-select"
                      value={t.assigne_a ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        void onTaskFieldChange(t.id_tache, {
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
                  ) : assigneeLabel(t) ? (
                    <span className="cu-tableur-assignee">
                      <span className="cu-tableur-assignee-avatar">
                        {assigneeInitials(t)}
                      </span>
                      <span className="cu-tableur-assignee-name">
                        {assigneeLabel(t)}
                      </span>
                    </span>
                  ) : (
                    <span className="cu-tableur-muted">—</span>
                  )}
                </td>
                <td
                  className="cu-tableur-col-status"
                  onClick={stopRow}
                  onMouseDown={stopRow}
                >
                  <TableurStatusDropdown
                    task={t}
                    canEdit={canEditTask}
                    saving={savingStatusTaskId === t.id_tache}
                    onChange={(key) => void onTaskStatusChange(t.id_tache, key)}
                  />
                </td>
                <td
                  className="cu-tableur-col-due"
                  onClick={stopRow}
                  onMouseDown={stopRow}
                >
                  {canEditTask ? (
                    <input
                      type="date"
                      className="cu-tableur-inline-date"
                      value={
                        t.date_limite_t
                          ? String(t.date_limite_t).slice(0, 10)
                          : ''
                      }
                      onChange={(e) => {
                        void onTaskFieldChange(t.id_tache, {
                          date_limite_t: e.target.value || null,
                        });
                      }}
                    />
                  ) : (
                    <span className={formatDueDate(t.date_limite_t) ? '' : 'cu-tableur-muted'}>
                      {formatDueDate(t.date_limite_t) || '—'}
                    </span>
                  )}
                </td>
                <td
                  className="cu-tableur-col-priority"
                  onClick={stopRow}
                  onMouseDown={stopRow}
                >
                  {canEditTask ? (
                    <select
                      className="cu-tableur-inline-select"
                      value={t.priorite_t ?? TaskPriority.MEDIUM}
                      onChange={(e) => {
                        void onTaskFieldChange(t.id_tache, {
                          priorite_t: e.target.value as TaskPriority,
                        });
                      }}
                    >
                      {Object.entries(TASK_PRIORITY_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`cu-tableur-priority ${priorityClass(t.priorite_t)}`}
                    >
                      {TASK_PRIORITY_LABELS[t.priorite_t] ?? t.priorite_t ?? '—'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {canCreateTask && (
              <tr className="cu-tableur-add-row">
                <td colSpan={7}>
                  <button
                    type="button"
                    className="cu-tableur-add-btn"
                    onClick={() => onOpenCreateTask('todo')}
                  >
                    <Plus size={14} aria-hidden />
                    Ajouter une tâche
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

export default TableurTaskView;
