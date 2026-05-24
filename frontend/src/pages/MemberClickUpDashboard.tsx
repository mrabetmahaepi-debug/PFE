import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import MemberDashboardStatCard from '../components/MemberDashboardStatCard';
import {
  MEMBER_DASHBOARD_ROUTES,
  navigateToGestionProjet,
} from '../lib/memberDashboardNavigation';
import { Activity, BarChart3 } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis } from 'recharts';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import {
  activityService,
  type EnterpriseActivityItem,
} from '../services/activity.service';
import {
  computeMemberWorkload,
  dashboardStatusCounts,
  MEMBER_DASHBOARD_WORKLOAD_COLORS,
  workloadToDashboardChartSegments,
} from '../lib/memberTaskWorkload';
import { computeMemberDashboardInsights } from '../lib/memberDashboardMetrics';
import { countMemberTermineeTasks } from '../lib/memberAssignedFilters';
import { filterMemberChartActivities } from '../lib/memberDashboardChartEvents';
import { WORKSPACE_REFRESH_EVENT, dispatchNotificationsRefresh } from '../lib/workspaceEvents';
import { alertService } from '../services/alert.service';
import { shouldRunAlertCheck } from '../lib/alertCheckThrottle';

const CHART_DAYS = 7;
import type { Projet } from '../types/project';
import type { Tache } from '../types/task';
import './MemberClickUpDashboard.css';

const REFRESH_MS = 45_000;

const MemberClickUpDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Tache[]>([]);
  const [projects, setProjects] = useState<Projet[]>([]);
  const [activityItems, setActivityItems] = useState<EnterpriseActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadActivity = useCallback(async () => {
    try {
      const feed = await activityService.getMemberChartActivity(CHART_DAYS);
      setActivityItems(filterMemberChartActivities(feed));
    } catch {
      setActivityItems([]);
    }
  }, []);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [loadedProjects, myTasks] = await Promise.all([
        projectService.getAll().catch(() => [] as Projet[]),
        taskService.getMyTasks().catch(() => [] as Tache[]),
      ]);
      setProjects(loadedProjects);
      setTasks(myTasks);
    } catch (err) {
      console.error('Member dashboard load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    void loadActivity();
    if (shouldRunAlertCheck()) {
      alertService
        .triggerCheck()
        .then(() => dispatchNotificationsRefresh())
        .catch((e) => console.error('Alert check failed:', e));
    }
  }, [loadActivity]);

  useEffect(() => {
    const onRefresh = () => {
      void loadData(true);
      void loadActivity();
    };
    window.addEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
  }, [loadActivity]);

  useEffect(() => {
    const t = window.setInterval(() => {
      void loadData(true);
      void loadActivity();
    }, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [loadActivity]);

  const workload = useMemo(() => computeMemberWorkload(tasks), [tasks]);
  const statusCounts = useMemo(() => dashboardStatusCounts(workload), [workload]);
  /** Aligns with Assigné à moi + Statut TERMINÉ deep-link. */
  const termineeCount = useMemo(() => countMemberTermineeTasks(tasks), [tasks]);
  const chartSegments = useMemo(
    () => workloadToDashboardChartSegments(workload),
    [workload]
  );

  const chartData = useMemo(() => {
    const visible = chartSegments.filter((s) => s.value > 0);
    if (visible.length === 0) {
      return [{ key: 'empty', label: 'Aucune', value: 1, color: '#e8eaed' }];
    }
    return visible;
  }, [chartSegments]);

  const insights = useMemo(
    () => computeMemberDashboardInsights(tasks, activityItems),
    [tasks, activityItems]
  );

  const activityTotal = useMemo(
    () => insights.activityByDay.reduce((s, d) => s + d.count, 0),
    [insights.activityByDay]
  );

  const goToGestionProjet = useCallback(() => {
    void navigateToGestionProjet(navigate, projects);
  }, [navigate, projects]);

  if (loading && tasks.length === 0 && projects.length === 0) {
    return (
      <motion.div className="mcdb mcdb--loading">
        <div className="cu-loader" />
        <p>Chargement du tableau de bord…</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="mcdb"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <section className="mcdb-stats-row" aria-label="Statistiques rapides">
        <MemberDashboardStatCard
          icon="📁"
          label="Projets"
          value={projects.length}
          ariaLabel={`Projets : ${projects.length}. Ouvrir Gestion de projet`}
          onClick={goToGestionProjet}
        />
        <MemberDashboardStatCard
          icon="📋"
          label="Tâches assignées"
          value={tasks.length}
          ariaLabel={`Tâches assignées : ${tasks.length}. Voir Assigné à moi`}
          onClick={() => navigate(MEMBER_DASHBOARD_ROUTES.assigned)}
        />
        <MemberDashboardStatCard
          icon="⏰"
          label="En retard"
          value={statusCounts.enRetard}
          valueClassName="mcdb-stat-value--warn"
          ariaLabel={`En retard : ${statusCounts.enRetard}. Voir Aujourd'hui et en retard`}
          onClick={() => navigate(MEMBER_DASHBOARD_ROUTES.todayOverdue)}
        />
        <MemberDashboardStatCard
          icon="✅"
          label="Terminées"
          value={termineeCount}
          valueClassName="mcdb-stat-value--done"
          ariaLabel={`Terminées : ${termineeCount}. Voir les tâches terminées`}
          onClick={() => navigate(MEMBER_DASHBOARD_ROUTES.assignedTermine)}
        />
      </section>

      <section className="mcdb-charts-row" aria-label="Charge de travail et activité">
        <article className="mcdb-card mcdb-workload-card" aria-label="Workload by Status">
          <header className="mcdb-card-head">
            <div className="mcdb-card-title-wrap">
              <BarChart3 size={18} className="mcdb-card-icon" aria-hidden />
              <h2 className="mcdb-card-title">Workload by Status</h2>
            </div>
          </header>
          <div className={`mcdb-workload-body${loading ? ' is-loading' : ''}`}>
            <div className="mcdb-workload-chart">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={chartData.length > 1 ? 3 : 0}
                    cornerRadius={4}
                    dataKey="value"
                    nameKey="label"
                    stroke="#ffffff"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [value, name]}
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e8eaed',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mcdb-workload-center" aria-hidden>
                <span className="mcdb-workload-total">{workload.total}</span>
                <span className="mcdb-workload-sub">tâches</span>
              </div>
            </div>
            <div className="mcdb-status-grid">
              <div className="mcdb-status-row mcdb-status-row--afaire">
                <span className="mcdb-status-label">
                  <span
                    className="mcdb-status-dot"
                    style={{ background: MEMBER_DASHBOARD_WORKLOAD_COLORS.a_faire }}
                    aria-hidden
                  />
                  À FAIRE
                </span>
                <strong>{statusCounts.aFaire}</strong>
              </div>
              <div className="mcdb-status-row mcdb-status-row--encours">
                <span className="mcdb-status-label">
                  <span
                    className="mcdb-status-dot"
                    style={{ background: MEMBER_DASHBOARD_WORKLOAD_COLORS.en_cours }}
                    aria-hidden
                  />
                  EN COURS
                </span>
                <strong>{statusCounts.enCours}</strong>
              </div>
              <div className="mcdb-status-row mcdb-status-row--retard">
                <span className="mcdb-status-label">
                  <span
                    className="mcdb-status-dot"
                    style={{ background: MEMBER_DASHBOARD_WORKLOAD_COLORS.en_retard }}
                    aria-hidden
                  />
                  EN RETARD
                </span>
                <strong>{statusCounts.enRetard}</strong>
              </div>
              <div className="mcdb-status-row mcdb-status-row--termine">
                <span className="mcdb-status-label">
                  <span
                    className="mcdb-status-dot"
                    style={{ background: MEMBER_DASHBOARD_WORKLOAD_COLORS.terminee }}
                    aria-hidden
                  />
                  TERMINÉ
                </span>
                <strong>{statusCounts.termine}</strong>
              </div>
            </div>
          </div>
        </article>

        <article className="mcdb-card mcdb-activity-card" aria-label="Activité des 7 derniers jours">
          <header className="mcdb-card-head">
            <div className="mcdb-card-title-wrap">
              <Activity size={18} className="mcdb-card-icon" aria-hidden />
              <h2 className="mcdb-card-title">Activité des 7 derniers jours</h2>
            </div>
          </header>
          <div className="mcdb-activity-card-body">
            {activityTotal === 0 ? (
              <p className="mcdb-activity-empty">Aucune activité cette semaine</p>
            ) : (
              <div className="mcdb-activity-chart">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={insights.activityByDay}
                    margin={{ top: 8, right: 4, left: -20, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#9aa0ab' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value: number) => [value, 'Activités']}
                      labelFormatter={(label) => String(label)}
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #e8eaed',
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#7b68ee"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {activityTotal > 0 ? (
              <p className="mcdb-activity-meta">
                {activityTotal} événement{activityTotal !== 1 ? 's' : ''} sur 7 jours
              </p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="mcdb-completion-row" aria-label="Taux de complétion">
        <article className="mcdb-card mcdb-completion-card">
          <div className="mcdb-completion-inner">
            <span className="mcdb-completion-label">Taux de complétion</span>
            <strong className="mcdb-completion-value">{insights.completionRate}%</strong>
            <div className="mcdb-completion-track">
              <div
                className="mcdb-completion-fill"
                style={{ width: `${insights.completionRate}%` }}
              />
            </div>
            <span className="mcdb-completion-meta">
              {statusCounts.termine} / {tasks.length} tâches terminées
            </span>
          </div>
        </article>
      </section>
    </motion.div>
  );
};

export default MemberClickUpDashboard;
