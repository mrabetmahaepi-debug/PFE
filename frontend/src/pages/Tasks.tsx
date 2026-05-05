import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  MoreHorizontal,
  User as UserIcon,
  Filter,
  Layers,
  ShieldAlert
} from 'lucide-react';
import { taskService } from '../services/task.service';
import { projectService } from '../services/project.service';
import { sprintService } from '../services/sprint.service';
import { useAuth } from '../hooks/useAuth';
import { type Tache, TaskStatus, TaskPriority } from '../types/task';
import type { Projet } from '../types/project';
import { type Sprint } from '../types/sprint';
import CreateTaskModal from '../components/CreateTaskModal';
import CreateSprintModal from '../components/CreateSprintModal';
import BackButton from '../components/BackButton';
import './Tasks.css';

const Tasks: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const isSuperAdmin = user?.role === 'SuperAdmin';
  
  const [tasks, setTasks] = useState<Tache[]>([]);
  const [projects, setProjects] = useState<Projet[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedSprintId, setSelectedSprintId] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchTasks(selectedProjectId);
      fetchSprints(selectedProjectId);
    }
  }, [selectedProjectId]);

  const fetchSprints = async (projectId: string) => {
    try {
      const data = await sprintService.getByProject(projectId);
      setSprints(data);
    } catch (error) {
      console.error("Failed to fetch sprints:", error);
    }
  };

  const fetchInitialData = async () => {
    try {
      const projectsData = await projectService.getAll();
      setProjects(projectsData);
      if (projectsData.length > 0) {
        setSelectedProjectId(projectsData[0].id_projet.toString());
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      setLoading(false);
    }
  };

  const fetchTasks = async (projectId: string) => {
    setLoading(true);
    try {
      const data = await taskService.getByProject(projectId);
      setTasks(data);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.CRITICAL: return '#ef4444';
      case TaskPriority.HIGH: return '#f97316';
      case TaskPriority.MEDIUM: return '#3b82f6';
      case TaskPriority.LOW: return '#10b981';
      default: return '#64748b';
    }
  };

  const columns: { title: string; status: TaskStatus; icon: any }[] = [
    { title: 'À faire', status: TaskStatus.TODO, icon: <Clock size={18} /> },
    { title: 'En cours', status: TaskStatus.IN_PROGRESS, icon: <AlertTriangle size={18} /> },
    { title: 'Terminé', status: TaskStatus.DONE, icon: <CheckCircle2 size={18} /> },
  ];

  const filteredTasks = tasks.filter(t => {
    const matchesSprint = selectedSprintId === 'ALL' || t.id_sprint?.toString() === selectedSprintId;
    return matchesSprint;
  });

  return (
    <div className="tasks-page">
      <BackButton />
      <header className="page-header">
        <div>
          <h1>Tâches {isSuperAdmin ? '(Supervision)' : ''}</h1>
          <p className="subtitle">Visualisez {isSuperAdmin ? 'les tâches de n’importe quel projet' : 'et gérez les tâches de votre projet'}.</p>
        </div>
        <div className="header-actions">
          <div className="project-selector">
            <Filter size={18} />
            <select 
              value={selectedProjectId} 
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map(p => (
                <option key={p.id_projet} value={p.id_projet}>
                  {isSuperAdmin && p.entreprise ? `[${p.entreprise.nom}] ` : ''}{p.nom_p}
                </option>
              ))}
            </select>
          </div>

          <div className="project-selector">
            <Layers size={18} />
            <select 
              value={selectedSprintId} 
              onChange={(e) => setSelectedSprintId(e.target.value)}
            >
              <option value="ALL">Tous les Sprints</option>
              {sprints.map(s => (
                <option key={s.id_sprint} value={s.id_sprint}>{s.nom_s}</option>
              ))}
            </select>
          </div>

          {!isSuperAdmin && (
            <>
              {hasPermission('PROJECT_EDIT') && (
                <button className="secondary-btn" onClick={() => setIsSprintModalOpen(true)}>
                  <Layers size={20} />
                  <span>Nouveau Sprint</span>
                </button>
              )}
              {hasPermission('TASK_CREATE') && (
                <button className="primary-btn" onClick={() => setIsModalOpen(true)}>
                  <Plus size={20} />
                  <span>Nouvelle Tâche</span>
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {isSuperAdmin && (
        <div className="superadmin-banner">
          <ShieldAlert size={20} />
          <span>Mode Supervision : Modification des tâches désactivée pour le Super Admin.</span>
        </div>
      )}

      <div className="kanban-container">
        {columns.map(column => (
          <div key={column.status} className="kanban-column">
            <div className="column-header">
              <div className="column-title">
                {column.icon}
                <span>{column.title}</span>
                <span className="count">
                  {filteredTasks.filter(t => t.statut_t === column.status).length}
                </span>
              </div>
              {!isSuperAdmin && hasPermission('TASK_CREATE') && (
                <button className="add-task-btn" onClick={() => setIsModalOpen(true)}>
                  <Plus size={16} />
                </button>
              )}
            </div>

            <div className="column-content">
              {loading ? (
                <div className="skeleton-card"></div>
              ) : (
                <AnimatePresence mode='popLayout'>
                  {filteredTasks
                    .filter(t => t.statut_t === column.status)
                    .map(task => (
                      <motion.div
                        key={task.id_tache}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="premium-card task-card"
                      >
                        <div className="task-card-header">
                          <span 
                            className="priority-label" 
                            style={{ backgroundColor: `${getPriorityColor(task.priorite_t as any)}15`, color: getPriorityColor(task.priorite_t as any) }}
                          >
                            {task.priorite_t}
                          </span>
                          {!isSuperAdmin && <button className="more-btn"><MoreHorizontal size={16} /></button>}
                        </div>
                        
                        <h4 className="task-title">{task.nom_t}</h4>
                        <p className="task-desc">{task.description_t}</p>
                        
                        <div className="task-footer">
                          <div className="task-date">
                            <Clock size={12} />
                            <span>{task.date_limite_t ? new Date(task.date_limite_t).toLocaleDateString() : 'Pas d\'échéance'}</span>
                          </div>
                          <div className="task-assignee">
                            {task.utilisateur ? (
                              <div className="avatar-xs" title={`${task.utilisateur.prenom} ${task.utilisateur.nom}`}>
                                {task.utilisateur.prenom[0]}{task.utilisateur.nom[0]}
                              </div>
                            ) : (
                              <UserIcon size={14} className="unassigned" />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        ))}
      </div>

      {!isSuperAdmin && (
        <>
          <CreateTaskModal 
            isOpen={isModalOpen}
            projectId={selectedProjectId}
            onClose={() => setIsModalOpen(false)}
            onSuccess={() => fetchTasks(selectedProjectId)}
          />
          <CreateSprintModal
            isOpen={isSprintModalOpen}
            projectId={selectedProjectId}
            onClose={() => setIsSprintModalOpen(false)}
            onSuccess={() => fetchSprints(selectedProjectId)}
          />
        </>
      )}
    </div>
  );
};

export default Tasks;
