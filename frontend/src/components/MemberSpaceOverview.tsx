import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import MemberSpaceRecentCard from './MemberSpaceRecentCard';
import MemberSpaceWorkloadCard from './MemberSpaceWorkloadCard';
import { useSetMemberTopbarTitle } from '../context/MemberTopbarTitleContext';
import { MON_ESPACE_NAME } from '../lib/monEspaceRoute';
import type { Tache } from '../types/task';
import '../pages/MemberSpaceDashboard.css';

const TASK_REFRESH_MS = 45_000;

type MemberSpaceOverviewProps = {
  /** `dashboard` = page /home ; `workspace` = route Mon espace dans le workspace. */
  variant?: 'dashboard' | 'workspace';
};

/** Recent + Workload cards (partagés entre Dashboard membre et Mon espace workspace). */
const MemberSpaceOverview: React.FC<MemberSpaceOverviewProps> = ({
  variant = 'workspace',
}) => {
  const isDashboard = variant === 'dashboard';
  useSetMemberTopbarTitle(!isDashboard ? MON_ESPACE_NAME : null);
  const [tasks, setTasks] = useState<Tache[]>([]);
  const [projectCount, setProjectCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [projects, myTasks] = await Promise.all([
        projectService.getAll().catch(() => []),
        taskService.getMyTasks().catch(() => [] as Tache[]),
      ]);
      setProjectCount(projects.length);
      setTasks(myTasks);
    } catch (err) {
      console.error('Member space overview load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const onRefresh = () => void loadData(true);
    window.addEventListener('workspace:refresh', onRefresh);
    return () => window.removeEventListener('workspace:refresh', onRefresh);
  }, [loadData]);

  useEffect(() => {
    const t = window.setInterval(() => void loadData(true), TASK_REFRESH_MS);
    return () => window.clearInterval(t);
  }, [loadData]);

  if (loading && tasks.length === 0 && projectCount === 0) {
    return (
      <div
        className={`ms-dashboard ms-dashboard--loading${
          isDashboard ? '' : ' ms-dashboard--embedded ms-dashboard--mon-espace mon-espace-page'
        }`}
      >
        <div className="cu-loader" />
        <p>{isDashboard ? 'Chargement de votre espace…' : 'Chargement…'}</p>
      </div>
    );
  }

  return (
    <motion.div
      className={`ms-dashboard${isDashboard ? '' : ' ms-dashboard--embedded ms-dashboard--mon-espace mon-espace-page'}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="ms-dashboard-grid">
        <MemberSpaceRecentCard />
        <MemberSpaceWorkloadCard
          tasks={tasks}
          loading={loading}
          variant={isDashboard ? 'default' : 'mon-espace'}
        />
      </div>
    </motion.div>
  );
};

export default MemberSpaceOverview;
