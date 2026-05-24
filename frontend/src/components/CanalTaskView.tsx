import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatRecentActivityTime } from '../lib/formatRecentActivityTime';
import { normalizeTaskStatutKey } from '../lib/listStatusGroups';
import { KANBAN_WORKFLOW_COLUMNS } from '../lib/kanbanWorkflowColumns';
import {
  memberStatusPillClass,
  statutKeyToPillTone,
} from '../lib/memberStatusPill';
import { appPaths } from '../lib/workspaceRoutes';
import { useListPageContext } from './listPageContext';
import type { Tache } from '../types/task';
import './CanalTaskView.css';

function statusLabel(statut?: string | null): string {
  const key = normalizeTaskStatutKey(statut);
  const col = KANBAN_WORKFLOW_COLUMNS.find((c) => c.id === key);
  return col?.label ?? String(statut ?? '—');
}

function activityTimestamp(task: Tache): number {
  const raw = task.updatedAt ?? task.createdAt;
  if (!raw) return 0;
  const n = new Date(raw).getTime();
  return Number.isNaN(n) ? 0 : n;
}

function activitySummary(task: Tache): string {
  const updated = task.updatedAt ? new Date(task.updatedAt).getTime() : 0;
  const created = task.createdAt ? new Date(task.createdAt).getTime() : 0;
  if (created && (!updated || Math.abs(created - updated) < 2000)) {
    return 'a créé cette tâche';
  }
  return `a mis à jour le statut · ${statusLabel(task.statut_t)}`;
}

export interface CanalTaskViewProps {
  listId: number;
}

const CanalTaskView: React.FC<CanalTaskViewProps> = ({ listId }) => {
  const navigate = useNavigate();
  const { tasks, onTaskClick } = useListPageContext(listId);

  const feed = useMemo(() => {
    return [...tasks]
      .map((task) => ({
        task,
        sortTs: activityTimestamp(task),
        timeLabel: formatRecentActivityTime(
          task.updatedAt ?? task.createdAt ?? ''
        ),
        summary: activitySummary(task),
      }))
      .filter((row) => row.sortTs > 0)
      .sort((a, b) => b.sortTs - a.sortTs);
  }, [tasks]);

  const openTask = (task: Tache) => {
    if (onTaskClick) {
      onTaskClick(task);
      return;
    }
    navigate(appPaths.task(task.id_tache));
  };

  if (feed.length === 0) {
    return (
      <div className="cu-canal-view">
        <p className="cu-canal-empty">Aucune activité récente sur cette liste.</p>
      </div>
    );
  }

  return (
    <div className="cu-canal-view">
      <ul className="cu-canal-feed" role="list">
        {feed.map(({ task, timeLabel, summary }) => (
          <li key={task.id_tache} className="cu-canal-item">
            <div className="cu-canal-avatar" aria-hidden>
              {(task.utilisateur?.prenom?.[0] ?? task.utilisateur?.nom?.[0] ?? 'T').toUpperCase()}
            </div>
            <div className="cu-canal-body">
              <p className="cu-canal-line">
                <button
                  type="button"
                  className="cu-canal-task-name"
                  onClick={() => openTask(task)}
                >
                  {task.nom_t || 'Tâche'}
                </button>
                <span className="cu-canal-summary"> {summary}</span>
              </p>
              <div className="cu-canal-meta">
                <span
                  className={memberStatusPillClass(
                    statutKeyToPillTone(task.statut_t ?? '')
                  )}
                >
                  {statusLabel(task.statut_t)}
                </span>
                <time className="cu-canal-time">{timeLabel}</time>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CanalTaskView;
