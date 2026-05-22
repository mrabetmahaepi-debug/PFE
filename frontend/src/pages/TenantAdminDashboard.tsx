import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Briefcase,
  ChevronRight,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminActivityFeed from '../components/AdminActivityFeed';
import AdminKpiCard from '../components/AdminKpiCard';
import HeroTimeWidget from '../components/HeroTimeWidget';
import { alertService } from '../services/alert.service';
import {
  adminRiskService,
  type TenantAdminRiskSummary,
} from '../services/adminRisk.service';
import { projectService } from '../services/project.service';
import { teamService } from '../services/team.service';
import { useAuth } from '../hooks/useAuth';
import { ProjectStatus } from '../types/project';
import type { Projet } from '../types/project';
import './Dashboard.css';
import './Dashboard.clean.css';

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

const TenantAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [projectsCount, setProjectsCount] = useState(0);
  const [teamCount, setTeamCount] = useState(0);
  const [adminProjects, setAdminProjects] = useState<Projet[]>([]);
  const [adminProjectSearch, setAdminProjectSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [riskSummary, setRiskSummary] = useState<TenantAdminRiskSummary | null>(null);
  const [riskLoading, setRiskLoading] = useState(true);
  const [riskError, setRiskError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        alertService.triggerCheck().catch((e) => console.error('Alert check failed:', e));
        const [projects, members, risks] = await Promise.all([
          projectService.getAll(),
          teamService.getAllMembers(),
          adminRiskService.getSummary().catch((err: unknown) => {
            const message =
              err instanceof Error ? err.message : 'Impossible de charger les risques';
            setRiskError(message);
            return null;
          }),
        ]);
        setProjectsCount(projects.length);
        setTeamCount(members.length);
        setAdminProjects(projects);
        if (risks) setRiskSummary(risks);
      } catch (error) {
        console.error('Failed to fetch tenant admin dashboard:', error);
      } finally {
        setLoading(false);
        setRiskLoading(false);
      }
    })();
  }, []);

  const filteredAdminProjects = useMemo(() => {
    const searchLower = adminProjectSearch.trim().toLowerCase();
    const filtered = adminProjects.filter((project) => {
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
  }, [adminProjectSearch, adminProjects]);

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

  const riskCount = riskSummary?.totalAtRisk ?? 0;

  if (loading) {
    return (
      <motion.div className="cu-dashboard cu-dashboard--tenant-admin cu-dashboard--loading">
        <div className="cu-loader" />
        <p>Préparation de votre espace de travail…</p>
      </motion.div>
    );
  }

  return (
    <motion.div className="cu-dashboard cu-dashboard--tenant-admin">
      <motion.div className="cu-dashboard-top-actions" aria-label="Actions rapides">
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
      </motion.div>

      <section className="cu-hero" aria-label="En-tête workspace">
        <motion.div className="cu-hero-main">
          <span className="cu-hero-badge">Espaces</span>
          <h1 className="cu-hero-title">
            <span className="cu-hero-title-gradient">Bonjour {fullName}</span>{' '}
            <span className="cu-hero-title-wave" aria-hidden="true">
              👋
            </span>
          </h1>
          <p className="cu-hero-date">{heroDateLabel}</p>
          <p className="cu-hero-sub">
            Actions rapides, priorités et équipe — tout ce dont vous avez besoin pour avancer.
          </p>
        </motion.div>
        <HeroTimeWidget />
      </section>

      <div className="cu-kpi-row">
        <AdminKpiCard
          label="Projets actifs"
          value={projectsCount}
          icon={<Briefcase size={20} />}
          onClick={() => navigate('/projects')}
          trendPercent={8}
          variant="primary"
        />
        <AdminKpiCard
          label="Membres"
          value={teamCount}
          icon={<Users size={20} />}
          onClick={() => navigate('/team')}
          trendPercent={2}
        />
        <AdminKpiCard
          label="Risques"
          value={riskCount}
          icon={<AlertTriangle size={20} />}
          variant="risk"
          loading={riskLoading}
          error={riskError}
          trend={
            riskSummary
              ? {
                  delta: riskSummary.weeklyDelta,
                  periodLabel: 'cette semaine',
                  invertTrendColors: true,
                }
              : null
          }
          onClick={() => navigate('/projects?status=DELAYED')}
        />
      </div>

      <motion.div className="cu-main-grid">
        <section className="cu-panel cu-panel--projects cu-panel--projects-admin">
          <motion.div className="cu-panel-head cu-panel-head--projects">
            <div>
              <h3>Mes projets</h3>
              <p className="cu-panel-sub">
                Vue complète — {adminProjects.length} projet
                {adminProjects.length !== 1 ? 's' : ''} entreprise
              </p>
            </div>
            <button type="button" className="cu-link-btn" onClick={() => navigate('/projects')}>
              Voir tout <ChevronRight size={14} />
            </button>
          </motion.div>

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
                    <motion.div className="cu-project-meta">
                      <motion.div className="cu-project-meta-top">
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
                      </motion.div>
                      <span className="cu-project-meta-sub">
                        {project.responsable || 'Non assigné'}
                        {' · '}
                        {totalTasks} tâche{totalTasks !== 1 ? 's' : ''}
                      </span>
                      <motion.div className="cu-project-bar">
                        <motion.div
                          className="cu-project-bar-fill"
                          style={{ width: hasTasks ? `${prog}%` : '0%' }}
                        />
                      </motion.div>
                    </motion.div>
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
        </section>

        <AdminActivityFeed />
      </motion.div>
    </motion.div>
  );
};

export default TenantAdminDashboard;
