import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, Building2, CheckSquare, Clock, Layout, Plus, TrendingUp, UserPlus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CreateProjectModal from '../components/CreateProjectModal';
import ActivityItem from '../components/dashboard/ActivityItem';
import ProjectCard from '../components/dashboard/ProjectCard';
import QuickActionCard from '../components/dashboard/QuickActionCard';
import StatCard from '../components/dashboard/StatCard';
import TaskRow from '../components/dashboard/TaskRow';
import { useAuth } from '../hooks/useAuth';
import { statsService } from '../services/stats.service';
import { superAdminService } from '../services/superadmin.service';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const roleName = typeof user?.role === 'object' ? user.role?.nom : user?.role;
  const isSuperAdmin = roleName?.toString().trim().toUpperCase() === 'SUPERADMIN';
  const isAdmin = roleName?.toString().trim().toUpperCase() === 'ADMIN';
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isSuperAdmin) setStats(await superAdminService.getDashboardStats());
      else if (isAdmin) setStats(await statsService.getAdminStats());
      else setStats({});
    } catch (err: any) {
      console.error('Dashboard data load error:', err);
      setError('Unable to load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user?.id, isAdmin, isSuperAdmin]);

  const recentProjects = useMemo(
    () =>
      stats?.myProjects?.slice(0, 4) || [
        { id: 0, name: 'Website Redesign', tasksCount: 14, status: 'In Progress', members: [{}, {}, {}], progress: 68 },
        { id: 1, name: 'Mobile App Sprint', tasksCount: 9, status: 'Planning', members: [{}, {}], progress: 32 },
      ],
    [stats],
  );

  const upcomingTasks = useMemo(
    () =>
      stats?.upcomingTasks || [
        { id: 0, title: 'Finalize backlog prioritization', project: 'Website Redesign', dueDate: 'Today', priority: 'high' },
        { id: 1, title: 'Review API contract updates', project: 'Mobile App Sprint', dueDate: 'Tomorrow', priority: 'medium' },
        { id: 2, title: 'QA smoke test', project: 'Client Portal', dueDate: 'Fri', priority: 'low' },
      ],
    [stats],
  );

  const teamActivity = useMemo(
    () =>
      stats?.recentActivities?.slice(0, 5) || [
        { id: 0, user: 'Amine K.', action: 'moved 3 tasks to Done', date: new Date().toISOString() },
        { id: 1, user: 'Sara M.', action: 'commented on Mobile App Sprint', date: new Date().toISOString() },
      ],
    [stats],
  );

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <p className="text-sm font-medium text-rose-700">{error}</p>
        <button onClick={loadData} className="mt-3 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white">
          Retry
        </button>
      </div>
    );
  }

  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">Welcome, {user?.prenom}</h1>
        <p className="mt-1 text-sm text-slate-500">Your workspace is being prepared.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{isSuperAdmin ? 'Platform Overview' : 'Workspace Overview'}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isSuperAdmin ? 'Monitor platform health and global activity.' : "A focused snapshot of your team's progress today."}
          </p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isSuperAdmin ? (
          <>
            <StatCard label="Total Users" value={(stats?.totalUsers || 0).toLocaleString()} icon={Users} onClick={() => navigate('/team')} />
            <StatCard label="Enterprises" value={(stats?.totalEnterprises || 0).toLocaleString()} icon={Building2} onClick={() => navigate('/enterprises')} />
            <StatCard label="Pending Approvals" value={(stats?.alerts?.pending || 0).toLocaleString()} icon={Clock} tone="warning" onClick={() => navigate('/approvals')} />
            <StatCard label="Active Users" value={(stats?.health?.users?.active || 0).toLocaleString()} icon={TrendingUp} tone="success" onClick={() => navigate('/team')} />
          </>
        ) : (
          <>
            <StatCard label="Active Projects" value={(stats?.activeProjects || 0).toLocaleString()} icon={Briefcase} onClick={() => navigate('/projects')} />
            <StatCard label="Open Tasks" value={(stats?.totalTasks || 0).toLocaleString()} icon={CheckSquare} onClick={() => navigate('/tasks')} />
            <StatCard label="Team Members" value={(stats?.totalMembers || 0).toLocaleString()} icon={Users} onClick={() => navigate('/team')} />
            <StatCard label="My Projects" value={(stats?.myProjects?.length || 0).toLocaleString()} icon={Layout} onClick={() => navigate('/projects')} />
          </>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Recent Projects</h2>
              <button onClick={() => navigate('/projects')} className="text-xs font-medium text-[#5B5FEF]">View all</button>
            </div>
            <div className="space-y-2">
              {recentProjects.map((project: any) => (
                <ProjectCard
                  key={project.id}
                  name={project.name || project.nom_p || 'Untitled Project'}
                  status={project.status || project.statut_p || 'In Progress'}
                  tasks={project.tasksCount || 0}
                  members={project.members?.length || 0}
                  progress={project.progress || 55}
                  onClick={() => project.id && navigate(`/projects/${project.id}`)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Upcoming Tasks</h2>
            <div className="space-y-2">
              {upcomingTasks.map((task: any) => (
                <TaskRow
                  key={task.id}
                  title={task.title}
                  project={task.project}
                  dueDate={task.dueDate}
                  priority={task.priority === 'high' || task.priority === 'medium' || task.priority === 'low' ? task.priority : 'medium'}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Quick Actions</h2>
            <div className="space-y-2">
              <QuickActionCard title="New Project" description="Create a project workspace." icon={Plus} onClick={() => setIsProjectModalOpen(true)} />
              <QuickActionCard title="Invite Member" description="Add someone to your team." icon={UserPlus} onClick={() => navigate('/team')} />
              <QuickActionCard title="Manage Tasks" description="Review and update priorities." icon={CheckSquare} onClick={() => navigate('/tasks')} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Team Activity</h2>
            <div className="space-y-2">
              {teamActivity.map((activity: any) => (
                <ActivityItem
                  key={activity.id}
                  user={activity.user}
                  action={activity.action}
                  time={new Date(activity.date).toLocaleString()}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Project Status</h2>
            <div className="space-y-2">
              {[
                { label: 'On Track', value: stats?.statusSummary?.onTrack ?? 7, color: 'bg-emerald-500' },
                { label: 'At Risk', value: stats?.statusSummary?.atRisk ?? 2, color: 'bg-amber-500' },
                { label: 'Blocked', value: stats?.statusSummary?.blocked ?? 1, color: 'bg-rose-500' },
              ].map((status) => (
                <div key={status.label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${status.color}`} />
                    <span className="text-sm text-slate-700">{status.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{status.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {isAdmin && (
        <CreateProjectModal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} onSuccess={loadData} />
      )}
    </div>
  );
};

export default Dashboard;
