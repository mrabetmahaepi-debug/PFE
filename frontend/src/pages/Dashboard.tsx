import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Briefcase, 
  CheckSquare, 
  Users, 
  ArrowRight, 
  Building2,
  Bell,
  ShieldCheck,
  PlusCircle,
  UserPlus,
  Key,
  ExternalLink,
  Zap,
  Activity,
  ChevronRight,
  Clock
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import { teamService } from '../services/team.service';
import { alertService } from '../services/alert.service';
import { superAdminService } from '../services/superadmin.service';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { type Projet } from '../types/project';
import { TaskStatus } from '../types/task';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const roleName = typeof user?.role === 'object' ? user.role.nom : user?.role;
  const isSuperAdmin = roleName === 'SuperAdmin';
  
  const [stats, setStats] = useState({
    projectsCount: 0,
    tasksCount: 0,
    teamCount: 0,
    completionRate: 0,
    enterprisesCount: 0,
    pendingApprovals: 0
  });
  
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchSuperAdminData();
    } else {
      fetchDashboardData();
    }
  }, [isSuperAdmin]);

  const fetchSuperAdminData = async () => {
    try {
      setLoading(true);
      const dashboardStats = await superAdminService.getDashboardStats();
      
      setStats({
        projectsCount: dashboardStats.totalProjects,
        tasksCount: 0,
        teamCount: dashboardStats.totalAdmins,
        completionRate: 0,
        enterprisesCount: dashboardStats.totalEnterprises,
        pendingApprovals: dashboardStats.pendingApprovals
      });
      
      const actRes = await api.get('/activities').catch(() => ({ data: [] }));
      setRecentActivities((actRes.data || []).slice(0, 5));
      
      const projects = await projectService.getAll();
      setRecentProjects(projects.slice(0, 4));
      
    } catch (error) {
      console.error("Failed to fetch superadmin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      alertService.triggerCheck().catch(e => console.error("Alert check failed:", e));

      const [projects, members, tasks] = await Promise.all([
        projectService.getAll(),
        user?.role === 'Admin' ? teamService.getAllMembers() : Promise.resolve([]),
        taskService.getMyTasks().catch(() => [])
      ]);

      const completedTasks = tasks.filter(t => t.statut_t === TaskStatus.DONE).length;
      const rate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

      setStats(prev => ({
        ...prev,
        projectsCount: projects.length,
        tasksCount: tasks.length,
        teamCount: members.length,
        completionRate: rate
      }));

      setRecentProjects(projects.slice(0, 3));
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = isSuperAdmin ? [
    { label: 'Entreprises', value: stats.enterprisesCount, icon: <Building2 />, color: '#6366f1', type: 'xl', path: '/enterprises' },
    { label: 'Administrateurs', value: stats.teamCount, icon: <ShieldCheck />, color: '#10b981', type: 'xl', path: '/team' },
    { label: 'Projets Totaux', value: stats.projectsCount, icon: <Briefcase />, color: '#f59e0b', type: 'md', path: '/projects' },
    { label: 'En attente', value: stats.pendingApprovals, icon: <Bell />, color: '#ef4444', type: 'md', path: '/approvals' },
  ] : [
    { label: 'Projets Actifs', value: stats.projectsCount, icon: <Briefcase />, color: '#6366f1', type: 'xl', path: '/projects' },
    { label: 'Tâches Totales', value: stats.tasksCount, icon: <CheckSquare />, color: '#10b981', type: 'xl', path: '/tasks' },
    { label: 'Complétion', value: `${stats.completionRate}%`, icon: <Zap />, color: '#f59e0b', type: 'md', path: '/tasks' },
    { label: 'Membres', value: stats.teamCount, icon: <Users />, color: '#ef4444', type: 'md', path: '/team' },
  ];

  const quickActions = [
    { label: 'Ajouter Entreprise', icon: <PlusCircle size={20} />, path: '/enterprises', color: '#6366f1' },
    { label: 'Inviter Admin', icon: <UserPlus size={20} />, path: '/enterprises', color: '#10b981' },
    { label: 'Gérer Permissions', icon: <Key size={20} />, path: '/permissions', color: '#f59e0b' },
  ];

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loader"></div>
        <p>Préparation de votre espace de travail...</p>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="dashboard-page"
    >
      <header className="page-header">
        <motion.div variants={itemVariants}>
          <h1>
            {isSuperAdmin 
              ? 'Centre de contrôle Super Admin' 
              : `Bonjour, ${user?.prenom || 'Admin'} 👋`}
          </h1>
          <p className="subtitle">
            {isSuperAdmin 
              ? 'Supervisez la plateforme, les entreprises, les administrateurs et les accès depuis un seul espace.' 
              : 'Gérez et suivez l\'avancement de vos projets.'}
          </p>
        </motion.div>
        <motion.div variants={itemVariants} className="header-badges">
          {stats.pendingApprovals > 0 && isSuperAdmin && (
            <Link to="/approvals" className="pending-badge">
              <Bell size={14} /> {stats.pendingApprovals} demandes
            </Link>
          )}
        </motion.div>
      </header>

      {/* KPI Stats */}
      <div className="stats-grid">
        {statCards.map((stat) => (
          <motion.div 
            key={stat.label}
            variants={itemVariants}
            whileHover={{ y: -8, borderBottom: `4px solid ${stat.color}` }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(stat.path)}
            className={`premium-card stat-card ${stat.type}`}
            style={{ cursor: 'pointer' }}
          >
            <div className="stat-card-top">
              <div className="stat-icon-wrapper" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                {stat.icon}
              </div>
            </div>
            <div className="stat-info">
              <p>{stat.label}</p>
              <h3>{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions - Only for SuperAdmin */}
      {isSuperAdmin && (
        <section className="quick-actions-section">
          <div className="section-header">
            <h3>Actions rapides</h3>
          </div>
          <div className="quick-actions-grid">
            {quickActions.map((action) => (
              <motion.div 
                key={action.label}
                variants={itemVariants}
                whileHover={{ y: -4 }}
                className="action-card"
                onClick={() => navigate(action.path)}
              >
                <div className="action-icon" style={{ backgroundColor: action.color }}>
                  {action.icon}
                </div>
                <div className="action-info">
                  <span>{action.label}</span>
                </div>
                <ArrowRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Main Content */}
      <div className="dashboard-content-grid">
        {/* Supervision Projets */}
        <motion.section variants={itemVariants} className="dashboard-card supervision-sec">
          <div className="card-header">
            <h3>{isSuperAdmin ? 'Supervision des Projets' : 'Mes Projets'}</h3>
            <button className="text-btn" onClick={() => navigate('/projects')}>
              Voir tout <ChevronRight size={16} />
            </button>
          </div>
          <div className="project-strip-list">
            {recentProjects.length > 0 ? recentProjects.map((project: any) => {
              const prog = project.avancement || 0;
              const hasTasks = project.totalTasks > 0;
              let progColor = '#ef4444'; // rouge
              if (prog >= 70) progColor = '#10b981'; // vert
              else if (prog >= 30) progColor = '#f59e0b'; // orange

              return (
              <div key={project.id_projet} className="project-strip" onClick={() => navigate(`/projects/${project.id_projet}`)} style={{ cursor: 'pointer' }}>
                <div className="project-info-main">
                  <div className="project-avatar" style={{ background: `linear-gradient(135deg, var(--primary) 0%, #a855f7 100%)` }}>
                    {project.nom_p[0]}
                  </div>
                  <div className="project-titles">
                    <h4>{project.nom_p}</h4>
                    <p>{isSuperAdmin ? project.entreprise?.nom : `${project.totalTasks || project._count?.tache || 0} tâches`}</p>
                  </div>
                </div>
                
                <div className="project-progress-wrapper" style={{ flex: 1, margin: '0 2rem', minWidth: '150px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    <span>{hasTasks ? `Progression (${project.completedTasks}/${project.totalTasks})` : 'Aucune tâche'}</span>
                    <span style={{ color: hasTasks ? progColor : 'inherit' }}>{hasTasks ? `${prog}%` : '0%'}</span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${hasTasks ? prog : 0}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      style={{ height: '100%', backgroundColor: hasTasks ? progColor : '#cbd5e1', borderRadius: '4px' }}
                    />
                  </div>
                </div>

                <div className="project-stat-group">
                  <ExternalLink size={16} className="text-muted" />
                </div>
              </div>
            )}) : (
              <div className="empty-projects">
                <Briefcase size={32} />
                <p>Aucun projet actif en cours de supervision.</p>
                {!isSuperAdmin && (
                  <button className="text-btn" onClick={() => navigate('/projects')}>
                    Créer un projet
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.section>

        {/* Recent Activity Timeline */}
        <motion.section variants={itemVariants} className="dashboard-card activity-sec">
          <div className="card-header">
            <h3>{isSuperAdmin ? 'Activité plateforme' : 'Activité récente'}</h3>
            {isSuperAdmin && (
              <button className="text-btn mini" onClick={() => navigate('/activities')}>
                Voir tout <ArrowRight size={14} />
              </button>
            )}
          </div>
          <div className="activity-timeline">
            {isSuperAdmin ? (
              recentActivities.length > 0 ? (
                recentActivities.map((act, i) => (
                  <div key={act.id} className={`activity-item ${i === 0 ? 'active' : ''}`}>
                    <div className="activity-dot">
                      {act.status === 'ACTIVE' ? <ShieldCheck size={14} /> : <Clock size={14} />}
                    </div>
                    <div className="activity-content">
                      <p>
                        <strong>{act.user}</strong> - {act.action}
                      </p>
                      <span className="activity-time">{act.entreprise || act.enterprise || 'Plateforme'} • {new Date(act.date || Date.now()).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-activity">
                  <Activity size={32} />
                  <p>Aucune activité récente à signaler.</p>
                </div>
              )
            ) : (
              <div className="empty-state-placeholder">
                <Activity size={32} />
                <p>Flux d’activité bientôt disponible.</p>
              </div>
            )}
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
};

export default Dashboard;
