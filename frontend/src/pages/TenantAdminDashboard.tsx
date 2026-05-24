import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Briefcase,
  RefreshCw,
  Sparkles,
  UserPlus,
  Users,
  Wand2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminDashboardStatCard from '../components/AdminDashboardStatCard';
import AdminDashboardCharts from '../components/AdminDashboardCharts';
import { alertService } from '../services/alert.service';
import { shouldRunAlertCheck } from '../lib/alertCheckThrottle';
import {
  adminRiskService,
  type TenantAdminRiskSummary,
} from '../services/adminRisk.service';
import { projectService } from '../services/project.service';
import { teamService } from '../services/team.service';
import { activityService, type EnterpriseActivityItem } from '../services/activity.service';
import type { Projet } from '../types/project';
import { countActiveAdminProjects } from '../lib/adminDashboardAnalytics';
import { WORKSPACE_REFRESH_EVENT } from '../lib/workspaceEvents';
import { formatActivityTimestamp } from '../lib/formatActivityTimestamp';
import {
  countAdminEstimations,
  countAdminRecommendations,
  filterTenantAdminActivities,
  getTenantAdminActionKind,
} from '../lib/tenantAdminActivityFeed';
import './TenantAdminDashboard.css';

const ACTIVITY_LIMIT = 24;
const ACTIVITY_REFRESH_MS = 60_000;

function displayActivityTitle(item: EnterpriseActivityItem): string {
  if (item.title?.trim()) return item.title.trim();
  if (item.action?.trim()) return item.action.trim();
  return item.entityLabel?.trim() || 'Action administration';
}

function activityInitials(item: EnterpriseActivityItem): string {
  const source = item.entityLabel || item.user || item.action || 'A';
  return (source.trim()[0] || 'A').toUpperCase();
}

function activityNavigatePath(item: EnterpriseActivityItem): string {
  if (item.entityType === 'project' && item.entityId) return `/projects/${item.entityId}`;
  if (item.category === 'team' || item.type === 'invitation' || item.type === 'member') {
    return '/team';
  }
  if (item.category === 'admin') return '/permissions';
  return '/projects';
}

const TenantAdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Projet[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [activities, setActivities] = useState<EnterpriseActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityRefreshing, setActivityRefreshing] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [riskSummary, setRiskSummary] = useState<TenantAdminRiskSummary | null>(null);
  const [riskLoading, setRiskLoading] = useState(true);
  const [riskError, setRiskError] = useState<string | null>(null);

  const reloadProjects = useCallback(async () => {
    try {
      const loadedProjects = await projectService.getAll();
      setProjects(loadedProjects);
    } catch (error) {
      console.error('Failed to refresh tenant admin projects:', error);
    }
  }, []);

  const loadActivity = useCallback(async (silent = false) => {
    if (!silent) setActivityLoading(true);
    else setActivityRefreshing(true);
    setActivityError(null);
    try {
      const feed = await activityService.getEnterpriseFeed(ACTIVITY_LIMIT * 2);
      const filtered = filterTenantAdminActivities(feed).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setActivities(filtered.slice(0, ACTIVITY_LIMIT));
    } catch (err) {
      setActivities([]);
      setActivityError(
        err instanceof Error ? err.message : "Impossible de charger les actions admin."
      );
    } finally {
      setActivityLoading(false);
      setActivityRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        if (shouldRunAlertCheck()) {
          alertService.triggerCheck().catch((e) => console.error('Alert check failed:', e));
        }
        const [loadedProjects, members, risks] = await Promise.all([
          projectService.getAll(),
          teamService.getAllMembers(),
          adminRiskService.getSummary().catch((err: unknown) => {
            const message =
              err instanceof Error ? err.message : 'Impossible de charger les risques';
            setRiskError(message);
            return null;
          }),
        ]);
        setProjects(loadedProjects);
        setTeamCount(members.length);
        if (risks) setRiskSummary(risks);
      } catch (error) {
        console.error('Failed to fetch tenant admin dashboard:', error);
      } finally {
        setLoading(false);
        setRiskLoading(false);
      }
    })();
    void loadActivity();
  }, [loadActivity]);

  useEffect(() => {
    const timer = window.setInterval(() => void loadActivity(true), ACTIVITY_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadActivity]);

  useEffect(() => {
    const onWorkspaceRefresh = () => {
      void reloadProjects();
    };
    window.addEventListener(WORKSPACE_REFRESH_EVENT, onWorkspaceRefresh);
    return () =>
      window.removeEventListener(WORKSPACE_REFRESH_EVENT, onWorkspaceRefresh);
  }, [reloadProjects]);

  const activeProjectsCount = useMemo(
    () => countActiveAdminProjects(projects),
    [projects]
  );

  const estimationsCount = useMemo(() => countAdminEstimations(activities), [activities]);
  const recommendationsCount = useMemo(() => countAdminRecommendations(activities), [activities]);
  const recommendationsStatValue = useMemo(
    () => Math.max(recommendationsCount, riskSummary?.totalAtRisk ?? 0),
    [recommendationsCount, riskSummary]
  );

  const riskCount = riskSummary?.totalAtRisk ?? 0;

  if (loading) {
    return (
      <div className="tadb tadb--loading">
        <div className="cu-loader" />
        <p>Préparation de votre espace de travail…</p>
      </div>
    );
  }

  return (
    <motion.div
      className="tadb"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="tadb-top-actions" aria-label="Actions rapides">
        <button
          type="button"
          className="virtide-btn virtide-btn--primary"
          onClick={() => navigate('/projects?create=1')}
          aria-label="Créer un nouveau projet"
        >
          <span>+ Projet</span>
        </button>
        <button
          type="button"
          className="virtide-btn virtide-btn--soft"
          onClick={() => navigate('/invite')}
        >
          <UserPlus size={17} />
          <span>Inviter</span>
        </button>
      </div>

      <section className="tadb-stats-grid" aria-label="Statistiques administration">
        <AdminDashboardStatCard
          icon={<Briefcase size={18} />}
          label="Projets actifs"
          value={activeProjectsCount}
          tone="violet"
          ariaLabel={`Projets actifs : ${activeProjectsCount}`}
          onClick={() => navigate('/projects')}
        />
        <AdminDashboardStatCard
          icon={<Users size={18} />}
          label="Équipe"
          value={teamCount}
          tone="default"
          ariaLabel={`Équipe : ${teamCount}`}
          onClick={() => navigate('/team')}
        />
        <AdminDashboardStatCard
          icon={<AlertTriangle size={18} />}
          label="Risques / projets en retard"
          value={riskLoading ? '—' : riskError ? '—' : riskCount}
          tone="amber"
          ariaLabel={`Risques : ${riskCount}`}
          onClick={() => navigate('/projects?status=DELAYED')}
        />
        <AdminDashboardStatCard
          icon={<Wand2 size={18} />}
          label="Estimations automatiques"
          value={estimationsCount}
          tone="teal"
          ariaLabel={`Estimations automatiques : ${estimationsCount}`}
          onClick={() => navigate('/projects')}
        />
        <AdminDashboardStatCard
          icon={<Sparkles size={18} />}
          label="Recommandations"
          value={recommendationsStatValue}
          tone="rose"
          ariaLabel={`Recommandations : ${recommendationsStatValue}`}
          onClick={() => navigate('/recommendations')}
        />
      </section>

      <AdminDashboardCharts projects={projects} />

      <section className="tadb-panel" aria-label="Actions administration">
        <header className="tadb-panel-head">
          <div>
            <h2>Actions administration</h2>
            <p className="tadb-panel-sub">
              Inscriptions, invitations, projets, rôles et estimations
            </p>
          </div>
          <button
            type="button"
            className={`tadb-activity-refresh${activityRefreshing ? ' is-spinning' : ''}`}
            onClick={() => void loadActivity(true)}
            aria-label="Actualiser les actions"
            disabled={activityLoading}
          >
            <RefreshCw size={16} />
          </button>
        </header>

        <div className="tadb-activity-list">
          {activityLoading ? (
            <div className="tadb-skeleton-list" aria-hidden>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="tadb-skeleton-row" />
              ))}
            </div>
          ) : activityError ? (
            <div className="tadb-empty">
              <p>{activityError}</p>
              <button type="button" className="cu-link-btn" onClick={() => void loadActivity()}>
                Réessayer
              </button>
            </div>
          ) : activities.length > 0 ? (
            activities.map((act) => (
              <button
                key={act.id}
                type="button"
                className="tadb-activity-row"
                onClick={() => navigate(activityNavigatePath(act))}
              >
                <span className="tadb-activity-avatar" aria-hidden>
                  {activityInitials(act)}
                </span>
                <span className="tadb-activity-body">
                  <p className="tadb-activity-title" title={displayActivityTitle(act)}>
                    {displayActivityTitle(act)}
                  </p>
                  <p className="tadb-activity-kind">{getTenantAdminActionKind(act)}</p>
                </span>
                <span className="tadb-activity-time">{formatActivityTimestamp(act.date)}</span>
              </button>
            ))
          ) : (
            <div className="tadb-empty">
              <p>Aucune action récente</p>
              <span>
                Les inscriptions, invitations, créations de projet et mises à jour de rôles
                apparaîtront ici.
              </span>
            </div>
          )}
        </div>
      </section>
    </motion.div>
  );
};

export default TenantAdminDashboard;
