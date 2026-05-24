import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { projectService } from '../services/project.service';
import { PROJECTS_UPDATED_EVENT } from '../lib/workspaceEvents';

interface ProjectProgressProps {
  projectId: number;
  statusColor: string;
}

const ProjectProgress: React.FC<ProjectProgressProps> = ({ projectId, statusColor }) => {
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const load = () => {
      projectService
        .getProgress(projectId)
        .then((res) => {
          if (mounted) setProgress(res.progressPercent || res.progress || 0);
        })
        .catch(console.error);
    };
    load();
    const onRefresh = () => load();
    window.addEventListener(PROJECTS_UPDATED_EVENT, onRefresh);
    return () => {
      mounted = false;
      window.removeEventListener(PROJECTS_UPDATED_EVENT, onRefresh);
    };
  }, [projectId]);

  return (
    <>
      <div className="progress-labels">
        <span>Progression</span>
        <span className="percent-label">{progress}%</span>
      </div>
      <div className="super-progress-bar">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="progress-track"
          style={{ backgroundColor: statusColor }}
        />
      </div>
    </>
  );
};

export default ProjectProgress;
