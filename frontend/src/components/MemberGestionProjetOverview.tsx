import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  buildMemberProjectOverviewData,
  type MemberProjectOverviewData,
} from '../lib/memberProjectOverview';
import { MEMBER_DASHBOARD_PROJECT_NAME } from '../lib/memberDashboardNavigation';
import { useSetMemberTopbarTitle } from '../context/MemberTopbarTitleContext';
import { memberStatusPillClass, memberPriorityTextClass } from '../lib/memberStatusPill';
import type { ProjectTree } from '../types/hierarchy';
import type { Tache } from '../types/task';
import '../styles/memberStatusPill.css';
import './MemberGestionProjetOverview.css';

type MemberGestionProjetOverviewProps = {
  tree: ProjectTree | null;
  tasks: Tache[];
  loading?: boolean;
  canCreateSprint?: boolean;
  onCreateSprint?: () => void;
};

const SUMMARY_CARDS: {
  key: keyof MemberProjectOverviewData['summary'];
  label: string;
  icon: string;
}[] = [
  { key: 'sprints', label: 'Total sprints', icon: '🏃' },
  { key: 'lists', label: 'Total listes', icon: '📋' },
  { key: 'tasks', label: 'Total tâches', icon: '✓' },
  { key: 'completed', label: 'Tâches terminées', icon: '✅' },
];

const MemberGestionProjetOverview: React.FC<MemberGestionProjetOverviewProps> = ({
  tree,
  tasks,
  loading = false,
  canCreateSprint = false,
  onCreateSprint,
}) => {
  const data = useMemo(
    () => buildMemberProjectOverviewData(tree, tasks),
    [tree, tasks]
  );

  useSetMemberTopbarTitle(MEMBER_DASHBOARD_PROJECT_NAME);

  if (loading && !tree && tasks.length === 0) {
    return (
      <div className="mgpo mgpo--loading">
        <div className="cu-loader" />
        <p>Chargement du projet…</p>
      </div>
    );
  }

  const noAccessibleContent =
    !loading &&
    !canCreateSprint &&
    data.summary.sprints === 0 &&
    data.summary.lists === 0 &&
    data.summary.tasks === 0;

  return (
    <motion.div
      className="mgpo mgpo--navbar-title"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {noAccessibleContent ? (
        <p className="mgpo-access-empty" role="status">
          Aucun contenu disponible pour le moment
        </p>
      ) : null}
      <section className="mgpo-section" aria-label="Résumé du projet">
        <div className="mgpo-stats-row">
          {SUMMARY_CARDS.map((card) => (
            <article key={card.key} className="mgpo-stat-card">
              <span className="mgpo-stat-icon" aria-hidden>
                {card.icon}
              </span>
              <div className="mgpo-stat-body">
                <span className="mgpo-stat-label">{card.label}</span>
                <strong className="mgpo-stat-value">{data.summary[card.key]}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mgpo-section" aria-labelledby="mgpo-sprints-title">
        <div className="mgpo-card">
          <div className="mgpo-card-head">
            <h2 id="mgpo-sprints-title" className="mgpo-card-title">
              Sprints
            </h2>
            {canCreateSprint && onCreateSprint && (
              <button
                type="button"
                className="mgpo-add-sprint-btn"
                onClick={onCreateSprint}
              >
                + Ajouter Sprint
              </button>
            )}
          </div>
          <div className="mgpo-table-wrap">
            <table className="mgpo-table">
              <thead>
                <tr>
                  <th scope="col">Sprint</th>
                  <th scope="col">Nombre de listes</th>
                  <th scope="col">Nombre de tâches</th>
                  <th scope="col">Statut</th>
                </tr>
              </thead>
              <tbody>
                {data.sprints.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="mgpo-table-empty">
                      <span>Aucun sprint disponible</span>
                      {canCreateSprint && onCreateSprint && (
                        <button
                          type="button"
                          className="mgpo-empty-sprint-btn"
                          onClick={onCreateSprint}
                        >
                          + Créer votre premier sprint
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  data.sprints.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.listCount}</td>
                      <td>{row.taskCount}</td>
                      <td className="mgpo-cell-badge">
                        <span className={memberStatusPillClass(row.statusTone)}>
                          {row.status}
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

      <section className="mgpo-section" aria-labelledby="mgpo-lists-title">
        <div className="mgpo-card">
          <h2 id="mgpo-lists-title" className="mgpo-card-title">
            Listes
          </h2>
          <div className="mgpo-table-wrap">
            <table className="mgpo-table">
              <thead>
                <tr>
                  <th scope="col">Liste</th>
                  <th scope="col">Sprint</th>
                  <th scope="col">Tâches</th>
                </tr>
              </thead>
              <tbody>
                {data.lists.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="mgpo-table-empty">
                      Aucune liste
                    </td>
                  </tr>
                ) : (
                  data.lists.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.sprintName}</td>
                      <td>{row.taskCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mgpo-section" aria-labelledby="mgpo-tasks-title">
        <div className="mgpo-card">
          <h2 id="mgpo-tasks-title" className="mgpo-card-title">
            Tâches du projet
          </h2>
          <div className="mgpo-table-wrap">
            <table className="mgpo-table mgpo-table--tasks">
              <thead>
                <tr>
                  <th scope="col">Tâche</th>
                  <th scope="col">Sprint</th>
                  <th scope="col">Liste</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Date échéance</th>
                  <th scope="col">Priorité</th>
                </tr>
              </thead>
              <tbody>
                {data.taskRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="mgpo-table-empty">
                      Aucune tâche
                    </td>
                  </tr>
                ) : (
                  data.taskRows.map((row) => (
                    <tr key={row.id}>
                      <td className="mgpo-cell-task">{row.name}</td>
                      <td>{row.sprintName}</td>
                      <td>{row.listName}</td>
                      <td className="mgpo-cell-badge">
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

export default MemberGestionProjetOverview;
