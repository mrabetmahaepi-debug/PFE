import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { projectService } from '../services/project.service';

interface ProjectProgressProps {
  projectId: number;
  statusColor: string;
}

const ProjectProgress: React.FC<ProjectProgressProps> = ({ projectId, statusColor }) => {
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    projectService.getProgress(projectId)
      .then((res) => {
        if (mounted) setProgress(res.progressPercent || res.progress || 0);
      })
      .catch(console.error);

    return () => { mounted = false; };
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
