import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Layers,
  List,
  CheckSquare,
  TrendingUp,
  Plus,
  Loader2,
  ListTodo,
} from 'lucide-react';
import { buildProjectLandingData } from '../lib/projectLandingData';
import { memberStatusPillClass, memberPriorityTextClass } from '../lib/memberStatusPill';
import type { ProjectTree } from '../types/hierarchy';
import type { Projet } from '../types/project';
import type { Tache } from '../types/task';
import '../styles/memberStatusPill.css';
import './ProjectLandingPage.css';

export type ProjectLandingPageProps = {
  tree: ProjectTree | null;
  project: Projet | null;
  tasks: Tache[];
  loading?: boolean;
  statsLoading?: boolean;
  progressionPercent?: number | null;
  userId?: number;
  canCreateSprint?: boolean;
  canCreateList?: boolean;
  canCreateTask?: boolean;
  onCreateSprint?: () => void;
  onCreateList?: () => void;
  onCreateTask?: () => void;
  onOpenTask?: (taskId: number) => void;
  onViewMyTasks?: () => void;
};

const ProjectLandingPage: React.FC<ProjectLandingPageProps> = ({
  tree,
  project,
  tasks,
  loading = false,
  statsLoading = false,
  progressionPercent = null,
  userId,
  canCreateSprint = false,
  canCreateList = false,
  canCreateTask = false,
  onCreateSprint,
  onCreateList,
  onCreateTask,
  onOpenTask,
  onViewMyTasks,
}) => {
  const data = useMemo(
    () =>
      buildProjectLandingData(tree, tasks, {
        userId,
        progressionPercent,
      }),
    [tree, tasks, userId, progressionPercent]
  );

  const title = project?.nom_p ?? tree?.nom_p ?? 'Projet';
  const description =
    project?.description_p?.trim() ||
    tree?.description_p?.trim() ||
    'Aucune description fournie.';
  const roleLabel =
    tree?.currentUserProjectRole ?? project?.currentUserProjectRole ?? null;

  const showChefActions =
    data.isChefView &&
    (canCreateSprint || canCreateList || canCreateTask);
  const showDevActions =
    !data.isChefView && (canCreateTask || Boolean(onViewMyTasks));

  if (loading && !tree && tasks.length === 0) {
    return (
      <div className="plp plp--loading">
        <Loader2 size={22} className="animate-spin" aria-hidden />
        <span>Chargement du projet…</span>
      </div>
    );
  }

  return (
    <motion.div
      className="plp"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <header className="plp-header">
        <div className="plp-header-main">
          <h1 className="plp-title">{title}</h1>
          <p className="plp-description">{description}</p>
          {roleLabel ? (
            <span className="plp-role-badge">{roleLabel}</span>
          ) : null}
        </div>
        {(showChefActions || showDevActions) && (
          <div className="plp-quick-actions">
            {data.isChefView && canCreateSprint && onCreateSprint && (
              <button
                type="button"
                className="plp-quick-btn plp-quick-btn--primary"
                onClick={onCreateSprint}
              >
                <Plus size={14} aria-hidden />
                Sprint
              </button>
            )}
            {data.isChefView && canCreateList && onCreateList && (
              <button
                type="button"
                className="plp-quick-btn plp-quick-btn--primary"
                onClick={onCreateList}
              >
                <Plus size={14} aria-hidden />
                Liste
              </button>
            )}
            {canCreateTask && onCreateTask && (
              <button
                type="button"
                className="plp-quick-btn plp-quick-btn--primary"
                onClick={onCreateTask}
              >
                <Plus size={14} aria-hidden />
                Tâche
              </button>
            )}
            {!data.isChefView && onViewMyTasks && (
              <button
                type="button"
                className="plp-quick-btn plp-quick-btn--secondary"
                onClick={onViewMyTasks}
              >
                <ListTodo size={14} aria-hidden />
                Mes tâches
              </button>
            )}
          </div>
        )}
      </header>

      <section className="plp-section" aria-label="Statistiques du projet">
        <div className="plp-stats-row">
          <article className="plp-stat-card">
            <span className="plp-stat-icon" aria-hidden>
              <Layers size={18} />
            </span>
            <div className="plp-stat-body">
              <span className="plp-stat-label">Total sprints</span>
              <strong className="plp-stat-value">{data.summary.sprints}</strong>
            </div>
          </article>
          <article className="plp-stat-card">
            <span className="plp-stat-icon" aria-hidden>
              <List size={18} />
            </span>
            <div className="plp-stat-body">
              <span className="plp-stat-label">Total listes</span>
              <strong className="plp-stat-value">{data.summary.lists}</strong>
            </div>
          </article>
          <article className="plp-stat-card">
            <span className="plp-stat-icon" aria-hidden>
              <CheckSquare size={18} />
            </span>
            <div className="plp-stat-body">
              <span className="plp-stat-label">Total tâches</span>
              <strong className="plp-stat-value">{data.summary.tasks}</strong>
            </div>
          </article>
          <article className="plp-stat-card">
            <span className="plp-stat-icon" aria-hidden>
              <TrendingUp size={18} />
            </span>
            <div className="plp-stat-body">
              <span className="plp-stat-label">Progression</span>
              <strong className="plp-stat-value plp-stat-value--progress">
                {statsLoading ? '…' : `${data.summary.progressionPercent} %`}
              </strong>
            </div>
          </article>
        </div>
      </section>

      <section className="plp-section" aria-labelledby="plp-recent-title">
        <div className="plp-card">
          <h2 id="plp-recent-title" className="plp-card-title">
            Activité récente
          </h2>
          {data.recentActivity.length === 0 ? (
            <p className="plp-activity-empty">Aucune activité récente</p>
          ) : (
            <ul className="plp-activity-list" role="list">
              {data.recentActivity.map((item) => (
                <li key={item.id} className="plp-activity-item">
                  <span className="plp-activity-line">{item.line}</span>
                  <time className="plp-activity-time" dateTime="">
                    {item.time}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="plp-section" aria-labelledby="plp-sprints-title">
        <div className="plp-card">
          <h2 id="plp-sprints-title" className="plp-card-title">
            Aperçu des sprints
          </h2>
          {data.sprintCards.length === 0 ? (
            <p className="plp-empty-hint">Aucun sprint pour ce projet</p>
          ) : (
            <div className="plp-sprint-grid">
              {data.sprintCards.map((sprint) => (
                <article key={sprint.id} className="plp-sprint-card">
                  <div className="plp-sprint-card-head">
                    <h3 className="plp-sprint-name">{sprint.name}</h3>
                    <span className="plp-sprint-status">{sprint.status}</span>
                  </div>
                  <p className="plp-sprint-dates">{sprint.dateLabel}</p>
                  <div className="plp-sprint-meta">
                    <span>{sprint.listCount} liste{sprint.listCount !== 1 ? 's' : ''}</span>
                    <span>{sprint.taskCount} tâche{sprint.taskCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="plp-progress-track" aria-hidden>
                    <div
                      className="plp-progress-fill"
                      style={{ width: `${sprint.progressPercent}%` }}
                    />
                  </div>
                  <span className="plp-progress-label">
                    {sprint.progressPercent} % terminé
                  </span>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="plp-section" aria-labelledby="plp-tasks-title">
        <div className="plp-card">
          <h2 id="plp-tasks-title" className="plp-card-title">
            {data.assignedSectionTitle}
          </h2>
          <div className="plp-table-wrap">
            <table className="plp-table">
              <thead>
                <tr>
                  <th scope="col">Tâche</th>
                  <th scope="col">Sprint</th>
                  <th scope="col">Liste</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Échéance</th>
                  <th scope="col">Priorité</th>
                </tr>
              </thead>
              <tbody>
                {data.assignedTaskRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="plp-table-empty">
                      {data.isChefView
                        ? 'Aucune tâche dans ce projet'
                        : 'Aucune tâche assignée'}
                    </td>
                  </tr>
                ) : (
                  data.assignedTaskRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {onOpenTask ? (
                          <button
                            type="button"
                            className="plp-task-link"
                            onClick={() => onOpenTask(row.id)}
                          >
                            {row.name}
                          </button>
                        ) : (
                          row.name
                        )}
                      </td>
                      <td>{row.sprintName}</td>
                      <td>{row.listName}</td>
                      <td>
                        <span className={memberStatusPillClass(row.statusTone)}>
                          {row.statusLabel}
                        </span>
                      </td>
                      <td>{row.dueLabel}</td>
                      <td>
                        <span className={memberPriorityTextClass(row.priorityTone)}>
                          {row.priorityLabel}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </motion.div>
  );
};

export default ProjectLandingPage;
