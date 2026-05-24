import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListPageContext } from './listPageContext';
import { appPaths } from '../lib/workspaceRoutes';
import { normalizeTaskStatutKey } from '../lib/listStatusGroups';
import type { Tache } from '../types/task';
import './GanttTaskView.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const VISIBLE_DAYS = 28;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseTaskRange(task: Tache): { start: Date; end: Date } | null {
  const endRaw = task.date_limite_t;
  const startRaw = task.date_debut_t;
  const end = endRaw ? startOfDay(new Date(endRaw)) : null;
  const start = startRaw
    ? startOfDay(new Date(startRaw))
    : end
      ? new Date(end.getTime() - 2 * DAY_MS)
      : null;
  if (!start && !end) return null;
  const s = start ?? end!;
  const e = end && end.getTime() >= s.getTime() ? end : new Date(s.getTime() + DAY_MS);
  return { start: s, end: e };
}

function statusClass(statut?: string | null): string {
  const key = normalizeTaskStatutKey(statut);
  if (key === 'terminee') return 'cu-gantt-bar--done';
  if (key === 'en_cours') return 'cu-gantt-bar--progress';
  return 'cu-gantt-bar--todo';
}

export interface GanttTaskViewProps {
  listId: number;
}

const GanttTaskView: React.FC<GanttTaskViewProps> = ({ listId }) => {
  const navigate = useNavigate();
  const { tasks, onTaskClick } = useListPageContext(listId);

  const { rangeStart, days, rows } = useMemo(() => {
    const ranges = tasks
      .map((t) => ({ task: t, range: parseTaskRange(t) }))
      .filter((r): r is { task: Tache; range: { start: Date; end: Date } } =>
        Boolean(r.range)
      );

    const today = startOfDay(new Date());
    let min = today.getTime();
    let max = today.getTime() + VISIBLE_DAYS * DAY_MS;

    for (const { range } of ranges) {
      min = Math.min(min, range.start.getTime());
      max = Math.max(max, range.end.getTime() + DAY_MS);
    }

    const span = Math.max(VISIBLE_DAYS * DAY_MS, max - min);
    const rangeStart = new Date(min);
    const dayCount = Math.min(60, Math.ceil(span / DAY_MS));
    const days: Date[] = [];
    for (let i = 0; i < dayCount; i++) {
      days.push(new Date(min + i * DAY_MS));
    }

    const rows = ranges.sort((a, b) =>
      a.range.start.getTime() - b.range.start.getTime()
    );

    return { rangeStart, days, rows };
  }, [tasks]);

  const totalMs = Math.max(days.length * DAY_MS, DAY_MS);

  const openTask = (task: Tache) => {
    if (onTaskClick) {
      onTaskClick(task);
      return;
    }
    navigate(appPaths.task(task.id_tache));
  };

  if (rows.length === 0) {
    return (
      <div className="cu-gantt-view">
        <p className="cu-gantt-empty">
          Aucune tâche avec dates — ajoutez une date de début ou d&apos;échéance pour
          afficher la timeline.
        </p>
      </div>
    );
  }

  return (
    <div className="cu-gantt-view">
      <div className="cu-gantt-scroll">
        <div
          className="cu-gantt-grid"
          style={{ gridTemplateColumns: `200px repeat(${days.length}, minmax(36px, 1fr))` }}
        >
          <div className="cu-gantt-corner" />
          {days.map((day) => (
            <div key={day.toISOString()} className="cu-gantt-day-head">
              {day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </div>
          ))}

          {rows.map(({ task, range }) => {
            const offset =
              ((range.start.getTime() - rangeStart.getTime()) / totalMs) * 100;
            const width =
              ((range.end.getTime() - range.start.getTime() + DAY_MS) / totalMs) *
              100;
            return (
              <React.Fragment key={task.id_tache}>
                <button
                  type="button"
                  className="cu-gantt-row-label"
                  onClick={() => openTask(task)}
                  title={task.nom_t}
                >
                  {task.nom_t || 'Tâche'}
                </button>
                <div
                  className="cu-gantt-row-track"
                  style={{ gridColumn: `2 / span ${days.length}` }}
                >
                  <div
                    className={`cu-gantt-bar ${statusClass(task.statut_t)}`}
                    style={{
                      left: `${Math.max(0, Math.min(98, offset))}%`,
                      width: `${Math.max(2, Math.min(100 - offset, width))}%`,
                    }}
                  />
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GanttTaskView;
