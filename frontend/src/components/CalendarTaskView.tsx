import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Search, Settings } from 'lucide-react';
import { toIsoDateLocal } from './ActivityThemedCalendar';
import { useListPageContext } from './listPageContext';
import { appPaths } from '../lib/workspaceRoutes';
import { normalizeTaskStatutKey } from '../lib/listStatusGroups';
import { TaskStatus, type Tache } from '../types/task';
import './CalendarTaskView.css';

const WEEKDAYS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'] as const;
const MAX_TASKS_PER_CELL = 4;

function parseDueIso(raw?: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return toIsoDateLocal(
    new Date(d.getFullYear(), d.getMonth(), d.getDate())
  );
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function taskPillClass(task: Tache): string {
  const key = normalizeTaskStatutKey(task.statut_t);
  if (key === 'terminee' || task.statut_t === TaskStatus.DONE) {
    return 'cu-calendar-task--done';
  }
  if (key === 'en_cours' || task.statut_t === TaskStatus.IN_PROGRESS) {
    return 'cu-calendar-task--in-progress';
  }
  const prio = String(task.priorite_t ?? '').toUpperCase();
  if (prio === 'URGENT' || prio === 'HIGH') return 'cu-calendar-task--urgent';
  return '';
}

export interface CalendarTaskViewProps {
  listId: number;
}

const CalendarTaskView: React.FC<CalendarTaskViewProps> = ({ listId }) => {
  const navigate = useNavigate();
  const {
    tasks,
    canCreateTask,
    onOpenCreateTask,
    onTaskClick,
    highlightTaskId,
  } = useListPageContext(listId);

  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const [viewYear, setViewYear] = useState(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => today.getMonth());
  const [searchQuery, setSearchQuery] = useState('');

  const listTasks = useMemo(
    () =>
      tasks.filter(
        (t) => t.id_list == null || Number(t.id_list) === listId
      ),
    [tasks, listId]
  );

  const visibleTasks = useMemo(() => {
    let list = listTasks.filter((t) => parseDueIso(t.date_limite_t));
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => t.nom_t.toLowerCase().includes(q));
    }
    return list;
  }, [listTasks, searchQuery]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Tache[]>();
    for (const t of visibleTasks) {
      const iso = parseDueIso(t.date_limite_t);
      if (!iso) continue;
      const arr = map.get(iso) ?? [];
      arr.push(t);
      map.set(iso, arr);
    }
    return map;
  }, [visibleTasks]);

  const monthLabel = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    .toLowerCase();

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startOffset = (first.getDay() + 6) % 7;
    const total = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    const items: Array<{ date: Date | null; key: string }> = [];

    for (let i = 0; i < total; i++) {
      const dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        items.push({ date: null, key: `empty-${i}` });
      } else {
        const date = new Date(viewYear, viewMonth, dayNum);
        items.push({ date, key: toIsoDateLocal(date) });
      }
    }
    return items;
  }, [viewMonth, viewYear]);

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const handleTaskClick = (e: React.MouseEvent, task: Tache) => {
    e.stopPropagation();
    if (onTaskClick) {
      onTaskClick(task);
      return;
    }
    navigate(appPaths.task(task.id_tache));
  };

  const handleDayClick = (iso: string) => {
    if (!canCreateTask) return;
    onOpenCreateTask('todo', iso);
  };

  return (
    <div className="cu-calendar-view">
      <div className="cu-calendar-toolbar">
        <div className="cu-calendar-toolbar-inner">
          <button
            type="button"
            className="cu-calendar-today-btn"
            onClick={goToday}
          >
            Aujourd&apos;hui
          </button>
          <select
            className="cu-calendar-view-select"
            value="month"
            aria-label="Type de vue calendrier"
            onChange={() => {}}
          >
            <option value="month">Mois</option>
          </select>
          <button
            type="button"
            className="cu-calendar-nav-btn"
            onClick={goPrev}
            aria-label="Mois précédent"
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="cu-calendar-nav-btn"
            onClick={goNext}
            aria-label="Mois suivant"
          >
            <ChevronRight size={16} aria-hidden />
          </button>
          <span className="cu-calendar-month-label">{monthLabel}</span>
          <div className="cu-calendar-toolbar-actions">
            <label className="cu-list-toolbar-search">
              <Search size={14} aria-hidden />
              <input
                type="search"
                placeholder="Rechercher…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Rechercher des tâches"
              />
            </label>
            <button
              type="button"
              className="cu-list-toolbar-icon-btn"
              title="Paramètres"
              aria-label="Paramètres"
            >
              <Settings size={15} aria-hidden />
            </button>
            {canCreateTask && (
              <button
                type="button"
                className="cu-list-toolbar-add-btn"
                onClick={() => onOpenCreateTask('todo')}
              >
                <Plus size={14} strokeWidth={2.5} />
                Ajouter Tâche
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="cu-calendar-body">
        <div className="cu-calendar-weekdays" aria-hidden>
          {WEEKDAYS.map((d) => (
            <span key={d} className="cu-calendar-weekday">
              {d}
            </span>
          ))}
        </div>
        <div className="cu-calendar-grid" role="grid" aria-label={monthLabel}>
          {cells.map(({ date, key }) => {
            if (!date) {
              return (
                <div
                  key={key}
                  className="cu-calendar-cell cu-calendar-cell--empty"
                  aria-hidden
                />
              );
            }

            const iso = toIsoDateLocal(date);
            const dayTasks = tasksByDate.get(iso) ?? [];
            const isToday = isSameDay(date, today);
            const shown = dayTasks.slice(0, MAX_TASKS_PER_CELL);
            const overflow = dayTasks.length - shown.length;

            return (
              <div
                key={key}
                role="gridcell"
                tabIndex={canCreateTask ? 0 : undefined}
                className={`cu-calendar-cell ${
                  isToday ? 'cu-calendar-cell--today' : ''
                }`}
                onClick={() => handleDayClick(iso)}
                onKeyDown={(e) => {
                  if (
                    canCreateTask &&
                    (e.key === 'Enter' || e.key === ' ')
                  ) {
                    e.preventDefault();
                    handleDayClick(iso);
                  }
                }}
                aria-label={date.toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              >
                <span className="cu-calendar-cell-day-num">
                  {date.getDate()}
                </span>
                <div className="cu-calendar-cell-tasks">
                  {shown.map((t) => (
                    <button
                      key={t.id_tache}
                      type="button"
                      className={`cu-calendar-task ${taskPillClass(t)} ${
                        highlightTaskId === t.id_tache
                          ? 'cu-calendar-task--highlight'
                          : ''
                      }`}
                      onClick={(e) => handleTaskClick(e, t)}
                      title={t.nom_t}
                    >
                      {t.nom_t}
                    </button>
                  ))}
                  {overflow > 0 && (
                    <span className="cu-calendar-more">
                      +{overflow} de plus
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CalendarTaskView;
