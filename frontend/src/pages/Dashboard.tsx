import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Briefcase,
  Building2,
  Bell,
  CheckSquare,
  ChevronRight,
  Mail,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import HeroTimeWidget from '../components/HeroTimeWidget';
import MemberStatsCard from '../components/MemberStatsCard';
import MemberTasksByProjectChart from '../components/MemberTasksByProjectChart';
import MemberInsightsRow from '../components/MemberInsightsRow';
import MemberActivityFeed from '../components/MemberActivityFeed';
import SuperAdminAdminsByEnterpriseChart from '../components/SuperAdminAdminsByEnterpriseChart';
import SuperAdminProjectsByCompanyChart from '../components/SuperAdminProjectsByCompanyChart';
import SuperAdminCompanyGrowthChart from '../components/SuperAdminCompanyGrowthChart';
import { entrepriseService, type Entreprise } from '../services/entreprise.service';
import '../components/MemberStatsCard.css';
import { formatRelativeTime } from '../lib/formatRelativeTime';
import {
  isSuperAdminDashboardActivityVisible,
  normalizeSuperAdminAction,
} from '../lib/superAdminActivityFilter';
import { getRoleKey, isEnterpriseAdmin, isGlobalMember } from '../lib/permissions';
import TenantAdminDashboard from './TenantAdminDashboard';
import MemberClickUpDashboard from './MemberClickUpDashboard';
import type { EnterpriseActivityType } from '../services/activity.service';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import { teamService } from '../services/team.service';
import { alertService } from '../services/alert.service';
import { shouldRunAlertCheck } from '../lib/alertCheckThrottle';
import { dispatchNotificationsRefresh } from '../lib/workspaceEvents';
import { superAdminService } from '../services/superadmin.service';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { TaskPriority, TaskStatus, type Tache } from '../types/task';
import { ProjectStatus } from '../types/project';
import { isArchivedProject } from '../lib/projectStatus';
import type { Projet } from '../types/project';
import type { User } from '../types/auth.types';
import './Dashboard.css';
import './Dashboard.clean.css';
import './MemberSpaceDashboard.css';

function normalizeTaskStatusValue(statut: string | undefined | null): TaskStatus | null {
  const raw = String(statut ?? '').trim();
  if (!raw) return TaskStatus.TODO;
  const upper = raw.toUpperCase().replace(/\s+/g, '_');
  if (
    upper === 'TODO' ||
    upper === 'A_FAIRE' ||
    raw === 'À faire' ||
    raw === 'A faire'
  ) {
    return TaskStatus.TODO;
  }
  if (upper === 'IN_PROGRESS' || upper === 'EN_COURS' || raw === 'En cours') {
    return TaskStatus.IN_PROGRESS;
  }
  if (
    upper === 'DONE' ||
    upper === 'TERMINEE' ||
    upper === 'TERMINÉE' ||
    raw === 'Terminée' ||
    raw === 'Terminé'
  ) {
    return TaskStatus.DONE;
  }
  if (raw === TaskStatus.TODO || raw === TaskStatus.IN_PROGRESS || raw === TaskStatus.DONE) {
    return raw;
  }
  return null;
}

function isTaskDoneStatus(task: Tache): boolean {
  return normalizeTaskStatusValue(task.statut_t) === TaskStatus.DONE;
}

function isTaskTodoStatus(task: Tache): boolean {
  return normalizeTaskStatusValue(task.statut_t) === TaskStatus.TODO;
}

function isTaskInProgressStatus(task: Tache): boolean {
  return normalizeTaskStatusValue(task.statut_t) === TaskStatus.IN_PROGRESS;
}

function isTaskLateStatus(task: Tache): boolean {
  if (isTaskDoneStatus(task)) return false;
  if (!task.date_limite_t) return false;
  const due = new Date(task.date_limite_t);
  if (Number.isNaN(due.getTime())) return false;
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

/** Comptes exclusifs pour le dashboard membre (évite le double comptage retard + statut). */
function partitionMemberTaskAnalytics(tasks: Tache[]) {
  let todoCount = 0;
  let inProgressCount = 0;
  let doneCount = 0;
  let lateCount = 0;

  for (const task of tasks) {
    if (isTaskDoneStatus(task)) {
      doneCount += 1;
      continue;
    }
    if (isTaskLateStatus(task)) {
      lateCount += 1;
      continue;
    }
    if (isTaskInProgressStatus(task)) {
      inProgressCount += 1;
      continue;
    }
    if (isTaskTodoStatus(task)) {
      todoCount += 1;
      continue;
    }
    todoCount += 1;
  }

  const donutSegments = [
    { name: 'À faire', value: todoCount },
    { name: 'En cours', value: inProgressCount },
    { name: 'Terminée', value: doneCount },
    { name: 'En retard', value: lateCount },
  ].filter((row) => row.value > 0);

  return {
    todoCount,
    inProgressCount,
    doneCount,
    lateCount,
    total: tasks.length,
    donutSegments,
  };
}

function getProjectStatusColor(status: string): string {
  switch (status) {
    case ProjectStatus.IN_PROGRESS:
      return '#4f46e5';
    case ProjectStatus.COMPLETED:
      return '#10b981';
    case ProjectStatus.ON_HOLD:
      return '#f59e0b';
    case ProjectStatus.DELAYED:
      return '#ef4444';
    case ProjectStatus.PLANNING:
    default:
      return '#64748b';
  }
}

function getActivityIcon(type: EnterpriseActivityType) {
  switch (type) {
    case 'project':
      return <Briefcase size={14} />;
    case 'task':
      return <CheckSquare size={14} />;
    case 'user':
    case 'member':
      return <UserPlus size={14} />;
    case 'invitation':
      return <Mail size={14} />;
    case 'alert':
      return <AlertTriangle size={14} />;
    case 'access':
      return <ShieldCheck size={14} />;
    default:
      return <Activity size={14} />;
  }
}

function formatProjectStatus(status: string): string {
  switch (status) {
    case ProjectStatus.IN_PROGRESS:
      return 'En cours';
    case ProjectStatus.COMPLETED:
      return 'Terminé';
    case ProjectStatus.ON_HOLD:
      return 'En attente';
    case ProjectStatus.DELAYED:
      return 'En retard';
    case ProjectStatus.PLANNING:
      return 'Planning';
    default:
      return status?.replace(/_/g, ' ') || 'Planning';
  }
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const roleName = typeof user?.role === 'object' ? user.role?.nom : user?.role;
  const isSuperAdmin = roleName === 'SuperAdmin';
  const isTenantAdmin = getRoleKey(user) === 'ADMIN';
  const globalMember = isGlobalMember(user);
  const showTaskAnalytics = globalMember && !isSuperAdmin && !isTenantAdmin;
  const showProjectProgress = !isSuperAdmin && !isTenantAdmin;
  const showProjectsPanel = isTenantAdmin;

  const [stats, setStats] = useState({
    projectsCount: 0,
    tasksCount: 0,
    teamCount: 0,
    completionRate: 0,
    enterprisesCount: 0,
    pendingApprovals: 0,
  });

  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [adminProjects, setAdminProjects] = useState<Projet[]>([]);
  const [adminProjectSearch, setAdminProjectSearch] = useState('');
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [scopeTasks, setScopeTasks] = useState<Tache[]>([]);
  const [memberProjects, setMemberProjects] = useState<Projet[]>([]);
  const [superAdminMembers, setSuperAdminMembers] = useState<User[]>([]);
  const [superAdminProjects, setSuperAdminProjects] = useState<Projet[]>([]);
  const [superAdminCompanies, setSuperAdminCompanies] = useState<Entreprise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSuperAdmin) {
      void fetchSuperAdminData();
    } else {
      void fetchDashboardData();
    }
  }, [isSuperAdmin]);

  const fetchSuperAdminData = async () => {
    try {
      setLoading(true);
      const [dashboardStats, members, projects, companies] = await Promise.all([
        superAdminService.getDashboardStats(),
        teamService.getAllMembers().catch(() => [] as User[]),
        projectService.getAll().catch(() => [] as Projet[]),
        entrepriseService.getAll().catch(() => [] as Entreprise[]),
      ]);

      setSuperAdminMembers(Array.isArray(members) ? members : []);
      setSuperAdminProjects(Array.isArray(projects) ? projects : []);
      setSuperAdminCompanies(Array.isArray(companies) ? companies : []);

      setStats({
        projectsCount: dashboardStats.totalProjects,
        tasksCount: 0,
        teamCount: dashboardStats.totalAdmins,
        completionRate: 0,
        enterprisesCount: dashboardStats.totalEnterprises,
        pendingApprovals: dashboardStats.pendingApprovals,
      });

      const actRes = await api.get('/activities').catch(() => ({ data: [] }));
      const platformOnly = (actRes.data || []).filter(
        isSuperAdminDashboardActivityVisible
      );
      setRecentActivities(platformOnly.slice(0, 5));

      setRecentProjects([]);
    } catch (error) {
      console.error('Failed to fetch superadmin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    const tenantAdmin = getRoleKey(user) === 'ADMIN';
    try {
      if (shouldRunAlertCheck()) {
        alertService
          .triggerCheck()
          .then(() => dispatchNotificationsRefresh())
          .catch((e) => console.error('Alert check failed:', e));
      }

      const [projects, members, myTasks] = await Promise.all([
        projectService.getAll(),
        teamService.getAllMembers({ type: 'all' }).catch(() => []),
        taskService.getMyTasks().catch(() => [] as Tache[]),
      ]);

      let enterpriseTasks = myTasks;
      if (tenantAdmin && projects.length > 0) {
        const chunks = await Promise.all(
          projects.map((p) =>
            taskService.getByProject(String(p.id_projet)).catch(() => [] as Tache[])
          )
        );
        enterpriseTasks = chunks.flat();
      }

      const completedTasks = enterpriseTasks.filter((t) => t.statut_t === TaskStatus.DONE).length;
      const rate =
        enterpriseTasks.length > 0
          ? Math.round((completedTasks / enterpriseTasks.length) * 100)
          : 0;

      setStats({
        projectsCount: projects.length,
        tasksCount: enterpriseTasks.length,
        teamCount: members.length,
        completionRate: rate,
        enterprisesCount: 0,
        pendingApprovals: 0,
      });

      setScopeTasks(tenantAdmin ? [] : enterpriseTasks);
      if (tenantAdmin) {
        setAdminProjects(projects);
        setRecentProjects([]);
        setMemberProjects([]);
      } else {
        setAdminProjects([]);
        setRecentProjects(projects.slice(0, 4));
        setMemberProjects(projects);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const workspaceStatCards = [
    {
      label: 'Projets actifs',
      value: stats.projectsCount,
      icon: <Briefcase size={20} />,
      color: '#7B68EE',
      path: '/projects',
      trend: 8,
      up: true,
    },
    {
      label: 'Complétion',
      value: `${stats.completionRate}%`,
      icon: <Zap size={20} />,
      color: '#f59e0b',
      path: '/tasks',
      trend: stats.completionRate,
      up: stats.completionRate >= 50,
    },
    {
      label: 'Membres',
      value: stats.teamCount,
      icon: <Users size={20} />,
      color: '#86EFAC',
      path: '/team',
      trend: 2,
      up: true,
    },
  ];

  const statCards = isSuperAdmin
    ? [
        {
          label: 'Entreprises',
          value: stats.enterprisesCount,
          icon: <Building2 size={20} />,
          color: '#7B68EE',
          path: '/enterprises',
          trend: 12,
          up: true,
          featured: true,
        },
        {
          label: 'Administrateurs',
          value: stats.teamCount,
          icon: <ShieldCheck size={20} />,
          color: '#86EFAC',
          path: '/team',
          trend: 5,
          up: true,
        },
        {
          label: 'Projets totaux',
          value: stats.projectsCount,
          icon: <Briefcase size={20} />,
          color: '#A8A0E8',
          path: '/projects',
          trend: 3,
          up: true,
        },
        {
          label: 'En attente',
          value: stats.pendingApprovals,
          icon: <Bell size={20} />,
          color: '#FCA5A5',
          path: '/approvals',
          trend: stats.pendingApprovals > 0 ? 8 : 0,
          up: false,
        },
      ]
    : isTenantAdmin
      ? workspaceStatCards.filter((card) => card.label !== 'Complétion')
      : workspaceStatCards;

  const filteredAdminProjects = useMemo(() => {
    if (!isTenantAdmin) return [];

    const searchLower = adminProjectSearch.trim().toLowerCase();
    const filtered = adminProjects.filter((project) => {
      if (isArchivedProject(project)) return false;
      if (!searchLower) return true;
      return (
        project.nom_p?.toLowerCase().includes(searchLower) ||
        project.responsable?.toLowerCase().includes(searchLower) ||
        formatProjectStatus(project.statut_p).toLowerCase().includes(searchLower)
      );
    });

    return [...filtered].sort(
      (a, b) =>
        new Date(b.createdAt || b.date_debut || 0).getTime() -
        new Date(a.createdAt || a.date_debut || 0).getTime()
    );
  }, [adminProjectSearch, adminProjects, isTenantAdmin]);

  const progressBars = useMemo(() => {
    return recentProjects.map((p) => {
      const prog = p.avancement || 0;
      const total = p.totalTasks ?? p._count?.tache ?? 0;
      return {
        id: p.id_projet,
        name: p.nom_p,
        percent: total > 0 ? prog : 0,
        label: total > 0 ? `${prog}%` : '—',
      };
    });
  }, [recentProjects]);

  const taskAnalyticsSource = useMemo(() => {
    if (!showTaskAnalytics) return [];
    return scopeTasks;
  }, [scopeTasks, showTaskAnalytics]);

  const taskAnalytics = useMemo(() => {
    if (!showTaskAnalytics) return null;
    return partitionMemberTaskAnalytics(taskAnalyticsSource);
  }, [showTaskAnalytics, taskAnalyticsSource]);

  const memberRisksCount = useMemo(() => {
    if (!taskAnalytics) return 0;
    return taskAnalytics.lateCount;
  }, [taskAnalytics]);

  const displayName = user?.prenom || user?.name || 'Admin';
  const fullName =
    [user?.prenom, user?.nom].filter(Boolean).join(' ').trim() || displayName;

  const heroDateLabel = useMemo(() => {
    const formatted = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
    return formatted
      .split(' ')
      .map((word) => (/\d/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
      .join(' ');
  }, []);

  if (loading) {
    return (
      <div className="cu-dashboard cu-dashboard--loading">
        <div className="cu-loader" />
        <p>Préparation de votre espace de travail…</p>
      </div>
    );
  }

  if (isEnterpriseAdmin(user) && !isSuperAdmin) {
    return <TenantAdminDashboard />;
  }

  if (globalMember && !isSuperAdmin) {
    return <MemberClickUpDashboard />;
  }

  return (
    <motion.div
      className={`cu-dashboard${isSuperAdmin ? ' cu-dashboard--super-admin' : ''}${
        isTenantAdmin ? ' cu-dashboard--tenant-admin' : ''
      }${showTaskAnalytics ? ' cu-dashboard--member' : ''}`}
    >
      {isTenantAdmin && (
        <motion.div className="cu-dashboard-top-actions" aria-label="Actions rapides">
            <button
              type="button"
              className="virtide-btn virtide-btn--primary"
              onClick={() => navigate('/projects')}
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
        </motion.div>
      )}

      <section
        className={`cu-hero${isSuperAdmin ? ' cu-hero--super-admin' : ''}`}
        aria-label="En-tête workspace"
      >
        <div className="cu-hero-main">
          <span className="cu-hero-badge">Espaces</span>
          <h1 className="cu-hero-title">
            {isSuperAdmin ? (
              <>
                <span className="cu-hero-title-gradient">Bonjour {fullName}</span>{' '}
                <span className="cu-hero-title-wave" aria-hidden="true">
                  👋
                </span>
              </>
            ) : (
              <>
                <span className="cu-hero-title-gradient">Bonjour {fullName}</span>{' '}
                <span className="cu-hero-title-wave" aria-hidden="true">
                  👋
                </span>
              </>
            )}
          </h1>
          <p className="cu-hero-date">{heroDateLabel}</p>
          {globalMember ? (
            <p className="cu-hero-sub">
              {stats.projectsCount} projet{stats.projectsCount !== 1 ? 's' : ''}{' '}
              {stats.projectsCount !== 1 ? 'accessibles' : 'accessible'}
              {' · '}
              {stats.tasksCount} tâche{stats.tasksCount !== 1 ? 's' : ''} assignée
              {stats.tasksCount !== 1 ? 's' : ''} à vous
            </p>
          ) : (
            !isSuperAdmin && (
              <p className="cu-hero-sub">
                Actions rapides, priorités et équipe — tout ce dont vous avez besoin pour avancer.
              </p>
            )
          )}
        </div>

        <HeroTimeWidget />
      </section>

      {showTaskAnalytics ? (
        <div className="cu-kpi-row cu-member-kpi-row">
          <MemberStatsCard
            label="Projets"
            value={stats.projectsCount}
            icon={<Briefcase size={20} />}
            tint="projects"
            onClick={() => navigate('/projects')}
            loading={loading}
          />
          <MemberStatsCard
            label="Tâches"
            value={stats.tasksCount}
            icon={<CheckSquare size={20} />}
            tint="tasks"
            loading={loading}
          />
          <MemberStatsCard
            label="Risques"
            value={memberRisksCount}
            icon={<AlertTriangle size={20} />}
            tint="risks"
            loading={loading}
          />
        </div>
      ) : (
        <div className="cu-kpi-row">
          {statCards.map((stat) => (
            <button
              key={stat.label}
              type="button"
              className={`cu-kpi-card${'featured' in stat && stat.featured ? ' cu-kpi-card--featured' : ''}`}
              onClick={() => navigate(stat.path)}
            >
              <div className="cu-kpi-top">
                <span className="cu-kpi-icon">{stat.icon}</span>
                <span className={`cu-kpi-trend ${stat.up ? 'up' : 'down'}`}>
                  {stat.up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {typeof stat.trend === 'number' && stat.label !== 'Complétion'
                    ? `${stat.up ? '+' : '-'}${stat.trend}%`
                    : stat.label === 'Complétion'
                      ? `${stat.trend}%`
                      : stat.trend}
                </span>
              </div>
              <div className="cu-kpi-body">
                <span className="cu-kpi-value">{stat.value}</span>
                <span className="cu-kpi-label">{stat.label}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <motion.div className="cu-main-grid">
        {isSuperAdmin && (
          <SuperAdminAdminsByEnterpriseChart
            members={superAdminMembers}
            loading={loading}
          />
        )}

        {isSuperAdmin && (
          <SuperAdminProjectsByCompanyChart
            projects={superAdminProjects}
            loading={loading}
          />
        )}

        {isSuperAdmin && (
          <SuperAdminCompanyGrowthChart
            companies={superAdminCompanies}
            loading={loading}
          />
        )}

        {showProjectProgress && (
          <section className="cu-panel cu-panel--chart">
          <div className="cu-panel-head">
            <h3 className="cu-title-gradient">Progression des projets</h3>
            <button type="button" className="cu-link-btn" onClick={() => navigate('/projects')}>
              Voir tout
            </button>
          </div>
          <div className="cu-chart-bars">
            {progressBars.length > 0 ? (
              progressBars.map((bar) => (
                <div key={bar.id} className="cu-chart-row">
                  <span className="cu-chart-label" title={bar.name}>
                    {bar.name}
                  </span>
                  <div className="cu-chart-track">
                    <motion.div
                      className="cu-chart-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${bar.percent}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="cu-chart-val">{bar.label}</span>
                </div>
              ))
            ) : (
              <div className="cu-empty-inline">Aucun projet à afficher</div>
            )}
          </div>
        </section>
        )}

        {showProjectsPanel && (
        <section
          className={`cu-panel cu-panel--projects${isTenantAdmin ? ' cu-panel--projects-admin' : ''}`}
        >
          <div className="cu-panel-head cu-panel-head--projects">
            <div>
              <h3>Supervision des projets</h3>
              {isTenantAdmin && (
                <p className="cu-panel-sub">
                  Vue complète — {adminProjects.length} projet{adminProjects.length !== 1 ? 's' : ''}{' '}
                  entreprise
                </p>
              )}
            </div>
            <button type="button" className="cu-link-btn" onClick={() => navigate('/projects')}>
              Voir tout <ChevronRight size={14} />
            </button>
          </div>

          {isTenantAdmin ? (
            <>
              <label className="cu-admin-projects-search">
                <Search size={16} aria-hidden />
                <input
                  type="search"
                  value={adminProjectSearch}
                  onChange={(e) => setAdminProjectSearch(e.target.value)}
                  placeholder="Rechercher un projet, responsable, statut…"
                  aria-label="Rechercher des projets"
                />
              </label>
              <div className="cu-admin-projects-meta">
                <span>
                  {filteredAdminProjects.length} affiché
                  {filteredAdminProjects.length !== adminProjects.length
                    ? ` sur ${adminProjects.length}`
                    : ''}
                </span>
              </div>
              <div className="cu-project-list cu-project-list--scroll">
                {filteredAdminProjects.length > 0 ? (
                  filteredAdminProjects.map((project) => {
                    const prog = project.avancement ?? 0;
                    const totalTasks =
                      (project as Projet & { totalTasks?: number }).totalTasks ??
                      project._count?.tache ??
                      (project as Projet & { tachesCount?: number }).tachesCount ??
                      0;
                    const hasTasks = totalTasks > 0;
                    const status = project.statut_p || ProjectStatus.PLANNING;
                    const statusColor = getProjectStatusColor(status);
                    return (
                      <button
                        key={project.id_projet}
                        type="button"
                        className="cu-project-card cu-project-card--admin"
                        onClick={() => navigate(`/projects/${project.id_projet}`)}
                      >
                        <span className="cu-project-avatar">{project.nom_p?.[0] || '?'}</span>
                        <div className="cu-project-meta">
                          <div className="cu-project-meta-top">
                            <strong>{project.nom_p}</strong>
                            <span
                              className="cu-project-status-badge"
                              style={{
                                color: statusColor,
                                backgroundColor: `${statusColor}15`,
                                borderColor: `${statusColor}30`,
                              }}
                            >
                              {formatProjectStatus(status)}
                            </span>
                          </div>
                          <span className="cu-project-meta-sub">
                            {project.responsable || 'Non assigné'}
                            {' · '}
                            {totalTasks} tâche{totalTasks !== 1 ? 's' : ''}
                          </span>
                          <div className="cu-project-bar">
                            <motion.div
                              className="cu-project-bar-fill"
                              style={{ width: hasTasks ? `${prog}%` : '0%' }}
                            />
                          </div>
                        </div>
                        <span className="cu-project-pct">{hasTasks ? `${prog}%` : '0%'}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="cu-empty-block cu-empty-block--compact">
                    <Briefcase size={28} />
                    <p>
                      {adminProjects.length === 0
                        ? 'Aucun projet dans votre entreprise'
                        : 'Aucun projet ne correspond à votre recherche'}
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </section>
        )}

        {showTaskAnalytics ? (
          <MemberInsightsRow
            activity={<MemberActivityFeed />}
            tasksChart={
              <MemberTasksByProjectChart
                tasks={scopeTasks}
                projects={memberProjects}
                userId={user?.id_utilisateur ?? user?.id}
                loading={loading}
              />
            }
          />
        ) : (
          <section
            className={`cu-panel cu-panel--activity${
              isSuperAdmin ? ' cu-panel--activity-super' : ''
            }`}
          >
            <div className="cu-panel-head">
              <h3>{isSuperAdmin ? 'Activité plateforme' : 'Activité récente'}</h3>
              {isSuperAdmin && (
                <button type="button" className="cu-link-btn" onClick={() => navigate('/activities')}>
                  Voir tout
                </button>
              )}
            </div>
            <div className="cu-activity-list">
              {isSuperAdmin && recentActivities.length > 0 ? (
                recentActivities.map((act, i) => (
                  <div key={act.id} className={`cu-activity-item ${i === 0 ? 'is-first' : ''}`}>
                    <span className="cu-activity-dot">
                      {act.status === 'ACTIVE' ? <ShieldCheck size={12} /> : <Activity size={12} />}
                    </span>
                    <div>
                      <p>
                        <strong>{act.user}</strong> —{' '}
                        {normalizeSuperAdminAction(act.action) ?? act.action}
                      </p>
                      <span>
                        {act.entreprise || act.enterprise || 'Plateforme'} ·{' '}
                        {formatRelativeTime(act.date)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="cu-empty-block">
                  <Activity size={28} />
                  <p>Aucune activité récente</p>
                </div>
              )}
            </div>
          </section>
        )}

        {!isTenantAdmin && (
          <section className="cu-cta-banner">
            <div className="cu-cta-content">
              <span className="cu-cta-eyebrow">N&apos;oubliez pas</span>
              <h3>
                {isSuperAdmin
                  ? 'Validez les demandes en attente et gardez la plateforme à jour.'
                  : 'Passez en revue vos tâches et gardez vos projets sur la bonne voie.'}
              </h3>
              {showTaskAnalytics ? (
                <span className="cu-cta-btn cu-cta-btn--static">Voir maintenant</span>
              ) : (
                <button
                  type="button"
                  className="cu-cta-btn"
                  onClick={() => navigate(isSuperAdmin ? '/approvals' : '/tasks')}
                >
                  Voir maintenant
                </button>
              )}
            </div>
            <span className="cu-cta-illustration" aria-hidden>
              📊
            </span>
          </section>
        )}
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;
