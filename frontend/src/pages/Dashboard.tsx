import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Building2,
  Clock,
  MoreHorizontal,
  Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import { teamService } from '../services/team.service';
import { superAdminService } from '../services/superadmin.service';
import { useAuth } from '../hooks/useAuth';
import { TaskStatus } from '../types/task';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart,
  Bar
} from 'recharts';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const roleName = typeof user?.role === 'object' ? user.role?.nom : user?.role;
  const isSuperAdmin = roleName?.toString().trim().toUpperCase() === 'SUPERADMIN';
  
  const [stats, setStats] = useState<any>({
    projectsCount: 0,
    tasksCount: 0,
    teamCount: 0,
    completionRate: 0,
    enterprisesCount: 0,
    totalEnterprises: 0,
    totalUsers: 0,
    totalAdmins: 0,
    roleDistribution: [],
    dailyEvolution: [],
    recentActivities: [],
    pendingApprovals: 0,
    growth: { 
      users: { percentage: 0 }, 
      enterprises: { percentage: 0 }
    },
    alerts: { pending: 0 }
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        if (isSuperAdmin) {
          const data = await superAdminService.getDashboardStats();
          console.log("DASHBOARD DATA RECEIVED:", data);
          console.log("ENTREPRISES TOTAL:", data.totalEnterprises);
          console.log("CHART DATA:", data.dailyEvolution);
          if (isMounted) setStats(data);
        } else {
          const [projects, members, tasks] = await Promise.all([
            projectService.getAll().catch(() => []),
            roleName?.toString().trim().toUpperCase() === 'ADMIN' ? teamService.getAllMembers().catch(() => []) : Promise.resolve([]),
            taskService.getMyTasks().catch(() => [])
          ]);
          if (!isMounted) return;
          const completedTasks = tasks.filter((t: any) => t.statut_t === TaskStatus.DONE).length;
          setStats({
            projectsCount: projects.length,
            tasksCount: tasks.length,
            teamCount: members.length,
            completionRate: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0,
            recentActivities: [],
            roleDistribution: [],
            dailyEvolution: []
          });
        }
      } catch (err: any) {
        console.error("Dashboard data load error:", err);
        setError(err.response?.data?.message || err.response?.data?.error || "Une erreur est survenue lors du chargement des données.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    if (user) loadData();
    return () => { isMounted = false; };
  }, [isSuperAdmin, user?.id]);

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'];

  if (loading) return (
    <div className="loading-state">
      <div className="loader"></div>
      <p>Chargement de vos statistiques...</p>
    </div>
  );

  if (error) return (
    <div className="error-state">
      <div className="error-card">
        <h3>Erreur de chargement</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="primary-btn">Réessayer</button>
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="dashboard-page">
      <header className="page-header">
        <div className="header-left">
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--saas-text-primary, #0f172a)', letterSpacing: '-0.025em', margin: 0 }}>
            {isSuperAdmin ? 'Super Admin Control Center' : 'Tableau de bord'}
          </h1>
          <p className="subtitle" style={{ fontSize: '0.875rem', color: 'var(--saas-text-muted, #64748b)', fontWeight: 400, marginTop: '0.375rem', letterSpacing: '0.01em' }}>
            {isSuperAdmin 
              ? `Global platform overview • ${new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })}`
              : `Vue globale de la plateforme • ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`}
          </p>
        </div>
        <div className="header-right">
          {/* Unified profile is now in global Navbar */}
        </div>
      </header>

      <div className="dashboard-layout-v3">
        <div className="col-left" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="kpi-grid">
            <motion.div 
              className="stat-card-premium featured"
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/team')}
              style={{ cursor: 'pointer' }}
            >
              <div className="stat-card-top">
                <div className="icon-wrapper-circle"><Users size={20} /></div>
                <div className="badge-growth up">+{stats.growth?.users?.percentage || 0}%</div>
              </div>
              <div className="stat-main">
                <label>TOTAL USERS</label>
                <h2>{(stats.totalUsers || 0).toLocaleString()}</h2>
                <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.8 }}>Compared to previous month</p>
              </div>
            </motion.div>

            <motion.div 
              className="stat-card-premium"
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/enterprises')}
              style={{ cursor: 'pointer' }}
            >
              <div className="stat-card-top">
                <div className="icon-wrapper-circle"><Building2 size={20} /></div>
                <div className="badge-growth up">+{stats.growth?.enterprises?.percentage || 0}%</div>
              </div>
              <div className="stat-main">
                <label>ACTIVE COMPANIES</label>
                <h2>{stats.totalEnterprises || 0}</h2>
                <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--saas-text-muted)' }}>Active companies on platform</p>
              </div>
            </motion.div>

            <motion.div 
              className="stat-card-premium"
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/approvals')}
              style={{ cursor: 'pointer' }}
            >
              <div className="stat-card-top">
                <div className="icon-wrapper-circle"><Clock size={20} /></div>
                <div className="badge-growth down">-1.08%</div>
              </div>
              <div className="stat-main">
                <label>PENDING REQUESTS</label>
                <h2>{stats.alerts?.pending || 0}</h2>
                <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--saas-text-muted)' }}>Pending approvals this month</p>
              </div>
            </motion.div>

            <motion.div 
              className="stat-card-premium"
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/team?status=active')}
              style={{ cursor: 'pointer' }}
            >
              <div className="stat-card-top">
                <div className="icon-wrapper-circle"><Activity size={20} /></div>
                <div className="badge-growth up">{stats.health?.users?.perc || 0}% actifs</div>
              </div>
              <div className="stat-main">
                <label>ACTIVE USERS</label>
                <h2>{stats.health?.users?.active || 0}</h2>
                <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--saas-text-muted)' }}>Active within last 7 days</p>
              </div>
            </motion.div>
          </div>

          <div className="card-v3" style={{ flex: 1 }}>
            <div className="card-header-v3">
              <h3>Platform Growth</h3>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--saas-text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }} /> Users</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e0e7ff' }} /> Companies</span>
              </div>
            </div>
            <div className="bar-chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.dailyEvolution || []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(str) => str ? new Date(str).toLocaleDateString('en-US', { weekday: 'short' }) : ''} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="users" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={12} />
                  <Bar dataKey="enterprises" fill="#e0e7ff" radius={[4, 4, 0, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="col-right" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card-v3">
            <div className="card-header-v3">
              <h3>Role Distribution</h3>
              <MoreHorizontal size={18} color="var(--saas-text-muted)" />
            </div>
            <div className="radial-activity-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.roleDistribution || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {(stats.roleDistribution || []).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="radial-center-info">
                <span className="val">{stats.totalUsers}</span>
                <span className="lbl">Users</span>
              </div>
            </div>
            <div className="activity-legend">
              {(stats.roleDistribution || []).slice(0, 3).map((role: any, idx: number) => (
                <div key={role.name} className="legend-row">
                  <div className="legend-left">
                    <div className="legend-dot-square" style={{ background: COLORS[idx % COLORS.length] }} />
                    <span>{role.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <span>{role.value}</span>
                    <span className="legend-growth-val">+{Math.round(Math.random() * 5)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-v3" style={{ flex: 1 }}>
            <div className="card-header-v3">
              <h3>Recent Activity</h3>
              <button className="text-btn mini" onClick={() => navigate('/activities')}>View All</button>
            </div>
            <div className="feed-v3">
              {(stats.recentActivities || []).slice(0, 5).map((act: any) => (
                <div key={act.id} className="feed-item-v3">
                  <div className="avatar-v3">{act.user ? act.user[0] : '?'}</div>
                  <div className="feed-body-v3">
                    <p><strong>{act.user}</strong> {act.action?.replace('Nouvelle entreprise créée', 'New company created').replace('Admin invité', 'Admin invited')}</p>
                    <span>{new Date(act.date).toLocaleDateString('en-GB')} at {new Date(act.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
              {(!stats.recentActivities || stats.recentActivities.length === 0) && (
                <div className="empty-feed">No recent activity</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
