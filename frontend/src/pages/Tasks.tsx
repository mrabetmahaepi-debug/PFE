import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  MoreHorizontal,
  User as UserIcon,
  Filter,
  Layers,
  ShieldAlert,
  X,
  CalendarClock,
  Flame,
  Folder,
  Search,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { taskService } from '../services/task.service';
import { projectService } from '../services/project.service';
import { sprintService } from '../services/sprint.service';
import { teamService } from '../services/team.service';
import { usePermission } from '../hooks/usePermission';
import type { User as WorkspaceUser } from '../types/auth.types';
import {
  type Tache,
  TASK_PRIORITY_LABELS,
  TaskStatus,
  TaskPriority,
  normalizeTaskPriority,
} from '../types/task';
import type { Projet } from '../types/project';
import { type Sprint } from '../types/sprint';
import BackButton from '../components/BackButton';
import './Tasks.css';

type DueFilter = 'overdue' | 'soon' | 'urgent';

const DUE_FILTERS: Record<DueFilter, { label: string; description: string; icon: React.ReactNode; tone: string }> = {
  overdue: {
    label: 'Tâches en retard',
    description: 'Tâches dont la date limite est dépassée',
    icon: <AlertTriangle size={16} />,
    tone: 'danger',
  },
  soon: {
    label: 'Échéances cette semaine',
    description: 'Tâches dues dans les 7 prochains jours',
    icon: <CalendarClock size={16} />,
    tone: 'warning',
  },
  urgent: {
    label: 'Tâches urgentes',
    description: 'Priorités critiques ouvertes dans le workspace',
    icon: <Flame size={16} />,
    tone: 'danger',
  },
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const Tasks: React.FC = () => {
  const { isSuperAdmin } = usePermission();
  const [searchParams, setSearchParams] = useSearchParams();
  const dueFilter = (searchParams.get('due') as DueFilter | null) ?? null;
  const focusTaskId = searchParams.get('task');
  const isFilterMode =
    dueFilter !== null && dueFilter in DUE_FILTERS;
  
  const [tasks, setTasks] = useState<Tache[]>([]);
  const [projects, setProjects] = useState<Projet[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedSprintId, setSelectedSprintId] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Tache | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [teamMembers, setTeamMembers] = useState<WorkspaceUser[]>([]);
  const [assigneeDropdownOpenId, setAssigneeDropdownOpenId] = useState<string | null>(null);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');

  useEffect(() => {
    fetchProjectsList();
    teamService.getAllMembers({ type: 'all' }).then(setTeamMembers).catch(console.error);

    const closeDropdown = () => setAssigneeDropdownOpenId(null);
    window.addEventListener('click', closeDropdown);
    return () => window.removeEventListener('click', closeDropdown);
  }, []);

  useEffect(() => {
    if (isFilterMode) {
      // In filter mode (?due=...), aggregate tasks across every project the
      // user can access, and skip the per-project fetch path.
      if (projects.length > 0) fetchAllTasks();
      else setTasks([]);
    } else if (selectedProjectId) {
      fetchTasks(selectedProjectId);
      fetchSprints(selectedProjectId);
    }
  }, [selectedProjectId, isFilterMode, dueFilter, projects.length]);

  const fetchSprints = async (projectId: string) => {
    try {
      const data = await sprintService.getByProject(projectId);
      setSprints(data);
    } catch (error) {
      console.error("Failed to fetch sprints:", error);
    }
  };

  const fetchProjectsList = async () => {
    try {
      const projectsData = await projectService.getAll();
      setProjects(projectsData);
      // Only auto-select a project when not in filter mode; otherwise the
      // page renders the cross-project filtered Kanban instead.
      if (projectsData.length > 0 && !isFilterMode) {
        setSelectedProjectId(projectsData[0].id_projet.toString());
      } else if (projectsData.length === 0) {
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

  const fetchAllTasks = async () => {
    setLoading(true);
    try {
      const chunks = await Promise.all(
        projects.map((p) =>
          taskService.getByProject(String(p.id_projet)).catch(() => [] as Tache[])
        )
      );
      setTasks(chunks.flat());
    } finally {
      setLoading(false);
    }
  };

  const projectNameById = useMemo(() => {
    const m = new Map<number, string>();
    projects.forEach((p) => m.set(p.id_projet, p.nom_p));
    return m;
  }, [projects]);

  const clearDueFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('due');
    setSearchParams(next);
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (normalizeTaskPriority(priority)) {
      case TaskPriority.URGENT: return '#ef4444';
      case TaskPriority.HIGH: return '#f97316';
      case TaskPriority.MEDIUM: return '#3b82f6';
      case TaskPriority.LOW: return '#10b981';
      default: return '#64748b';
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('taskId');
    
    if (!taskId) return;

    const task = tasks.find(t => t.id_tache.toString() === taskId);
    if (!task || task.statut_t === status) return;

    // Optimistic UI update
    const updatedTasks = tasks.map(t => 
      t.id_tache.toString() === taskId ? { ...t, statut_t: status } : t
    );
    setTasks(updatedTasks);

    try {
      await taskService.updateStatus(taskId, status);
    } catch (error) {
      console.error("Failed to update task status:", error);
      // Revert if failed
      if (selectedProjectId) fetchTasks(selectedProjectId);
      else fetchAllTasks();
    }
  };

  const handleAssignTask = async (taskId: string, memberId: number | null) => {
    const previousTasks = [...tasks];
    const member = memberId ? teamMembers.find(m => m.id_utilisateur === memberId || m.id === memberId) : null;
    
    const updatedTasks = tasks.map(t => 
      t.id_tache.toString() === taskId 
        ? { ...t, assigne_a: memberId ?? undefined, utilisateur: member ? { nom: member.nom, prenom: member.prenom, email: member.email } : undefined }
        : t
    );
    setTasks(updatedTasks);
    
    if (selectedTask && selectedTask.id_tache.toString() === taskId) {
      setSelectedTask({ ...selectedTask, assigne_a: memberId ?? undefined, utilisateur: member ? { nom: member.nom, prenom: member.prenom, email: member.email } : undefined });
    }

    setAssigneeDropdownOpenId(null);
    setAssigneeSearchQuery('');

    try {
      await taskService.update(taskId, { assigne_a: memberId });
    } catch (error) {
      console.error("Failed to assign task:", error);
      setTasks(previousTasks);
    }
  };

  const columns: { title: string; status: TaskStatus; icon: any }[] = [
    { title: 'À faire', status: TaskStatus.TODO, icon: <Clock size={18} /> },
    { title: 'En cours', status: TaskStatus.IN_PROGRESS, icon: <AlertTriangle size={18} /> },
    { title: 'Terminé', status: TaskStatus.DONE, icon: <CheckCircle2 size={18} /> },
  ];

  const filteredTasks = tasks.filter((t) => {
    if (!isFilterMode) {
      return (
        selectedSprintId === 'ALL' ||
        t.id_sprint?.toString() === selectedSprintId
      );
    }
    if (dueFilter === 'overdue') {
      if (!t.date_limite_t || t.statut_t === TaskStatus.DONE) return false;
      return new Date(t.date_limite_t) < startOfToday();
    }
    if (dueFilter === 'soon') {
      if (!t.date_limite_t || t.statut_t === TaskStatus.DONE) return false;
      const today = startOfToday();
      const limit = new Date(today);
      limit.setDate(limit.getDate() + 7);
      const due = new Date(t.date_limite_t);
      return due >= today && due <= limit;
    }
    if (dueFilter === 'urgent') {
      return (
        normalizeTaskPriority(t.priorite_t) === TaskPriority.URGENT &&
        t.statut_t !== TaskStatus.DONE
      );
    }
    return true;
  });

  useEffect(() => {
    if (!focusTaskId || loading) return;
    const tmr = window.setTimeout(() => {
      const el = document.getElementById(`notif-task-${focusTaskId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('task-card--notif-focus');
      window.setTimeout(() => el.classList.remove('task-card--notif-focus'), 2600);
    }, 450);
    return () => clearTimeout(tmr);
  }, [focusTaskId, loading, tasks.length, isFilterMode, dueFilter, selectedProjectId]);

  const activeFilterMeta = isFilterMode && dueFilter ? DUE_FILTERS[dueFilter] : null;

  return (
    <div className="tasks-page">
      <BackButton />
      <header className="page-header">
        <div>
          <h1>Tâches {isSuperAdmin ? '(Supervision)' : ''}</h1>
          {(isFilterMode && activeFilterMeta) || isSuperAdmin ? (
            <p className="subtitle">
              {isFilterMode && activeFilterMeta
                ? `${activeFilterMeta.description} — résultats agrégés sur tous vos projets.`
                : 'Visualisez les tâches de n\u2019importe quel projet.'}
            </p>
          ) : null}
        </div>
        <div className="header-actions">
          {!isFilterMode && (
            <>
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

      {activeFilterMeta && (
        <div className={`filter-banner tone-${activeFilterMeta.tone}`}>
          <span className="filter-banner-icon">{activeFilterMeta.icon}</span>
          <div className="filter-banner-text">
            <strong>{activeFilterMeta.label}</strong>
            <span>
              {filteredTasks.length} tâche{filteredTasks.length > 1 ? 's' : ''}
              {' '}sur tous les projets
            </span>
          </div>
          <button
            type="button"
            className="filter-banner-reset"
            onClick={clearDueFilter}
            aria-label="Réinitialiser le filtre"
          >
            <X size={14} />
            Réinitialiser
          </button>
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
            </div>

            <div 
              className={`column-content ${dragOverColumn === column.status ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, column.status)}
              onDrop={(e) => handleDrop(e, column.status)}
              onDragLeave={() => setDragOverColumn(null)}
            >
              {loading ? (
                <div className="skeleton-card"></div>
              ) : (
                <AnimatePresence mode='popLayout'>
                  {filteredTasks
                    .filter(t => t.statut_t === column.status)
                    .map(task => (
                      <motion.div
                        key={task.id_tache}
                        id={`notif-task-${task.id_tache}`}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                      >
                        <div
                          className={`premium-card task-card ${draggedTaskId === task.id_tache.toString() ? 'is-dragging' : ''}`}
                          draggable={!isSuperAdmin}
                          onDragStart={(e) => handleDragStart(e, task.id_tache.toString())}
                          onDragEnd={handleDragEnd}
                          onClick={() => setSelectedTask(task)}
                        >
                        <div className="task-card-header">
                          <span 
                            className="priority-label" 
                            style={{ backgroundColor: `${getPriorityColor(task.priorite_t)}15`, color: getPriorityColor(task.priorite_t) }}
                          >
                            {TASK_PRIORITY_LABELS[normalizeTaskPriority(task.priorite_t)]}
                          </span>
                          {!isSuperAdmin && (
                            <button 
                              className="more-btn" 
                              onClick={(e) => { e.stopPropagation(); }}
                            >
                              <MoreHorizontal size={16} />
                            </button>
                          )}
                        </div>

                        {isFilterMode && (
                          <span className="task-project-tag">
                            <Folder size={11} />
                            {projectNameById.get(task.id_projet) || 'Projet'}
                          </span>
                        )}
                        
                        <h4 className="task-title">{task.nom_t}</h4>
                        <p className="task-desc">{task.description_t}</p>
                        
                        <div className="task-footer">
                          <div className="task-date">
                            <Clock size={12} />
                            <span>{task.date_limite_t ? new Date(task.date_limite_t).toLocaleDateString() : 'Pas d\'échéance'}</span>
                          </div>
                          <div className="task-assignee" style={{ position: 'relative' }}>
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isSuperAdmin) {
                                  setAssigneeDropdownOpenId(assigneeDropdownOpenId === task.id_tache.toString() ? null : task.id_tache.toString());
                                }
                              }}
                              style={{ cursor: isSuperAdmin ? 'default' : 'pointer', padding: '2px', borderRadius: 'var(--radius-md)', transition: 'background 0.2s' }}
                              className="assignee-trigger"
                            >
                              {task.utilisateur ? (
                                <div className="assignee-with-name">
                                  <div className="avatar-xs" title={`${task.utilisateur.prenom} ${task.utilisateur.nom}`}>
                                    {task.utilisateur.prenom[0]}{task.utilisateur.nom[0]}
                                  </div>
                                  <span className="assignee-name">{task.utilisateur.prenom}</span>
                                </div>
                              ) : (
                                <div className="unassigned-badge">
                                  <UserIcon size={12} />
                                  <span>Non assigné</span>
                                </div>
                              )}
                            </div>

                            {assigneeDropdownOpenId === task.id_tache.toString() && (
                              <div 
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute', bottom: '110%', right: 0, minWidth: '240px',
                                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-lg)', padding: '0.75rem',
                                  boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)', zIndex: 100,
                                  maxHeight: '300px', overflowY: 'auto'
                                }}
                              >
                                <div className="search-box" style={{ marginBottom: '0.75rem', padding: '0.25rem 0.5rem', height: '32px' }}>
                                  <Search size={14} />
                                  <input 
                                    type="text" 
                                    placeholder="Chercher..." 
                                    value={assigneeSearchQuery}
                                    onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                                    style={{ fontSize: '0.8rem' }}
                                    autoFocus
                                  />
                                </div>
                                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <div 
                                    onClick={() => handleAssignTask(task.id_tache.toString(), null)}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem',
                                      cursor: 'pointer', borderRadius: 'var(--radius-md)', transition: 'all 0.2s',
                                      backgroundColor: !task.utilisateur ? 'var(--primary-light)' : 'transparent'
                                    }}
                                  >
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Non assigné</span>
                                  </div>
                                  {teamMembers
                                    .filter(m => {
                                      if (!assigneeSearchQuery) return true;
                                      const fullName = `${m.prenom} ${m.nom}`.toLowerCase();
                                      return fullName.includes(assigneeSearchQuery.toLowerCase());
                                    })
                                    .map(m => {
                                      const mId = m.id_utilisateur ?? m.id;
                                      const isActive = task.assigne_a === mId;
                                      return (
                                        <div 
                                          key={mId}
                                          onClick={() => handleAssignTask(task.id_tache.toString(), Number(mId))}
                                          style={{
                                            display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem',
                                            cursor: 'pointer', borderRadius: 'var(--radius-md)', transition: 'all 0.2s',
                                            backgroundColor: isActive ? 'var(--primary-light)' : 'transparent'
                                          }}
                                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-main)'}
                                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = isActive ? 'var(--primary-light)' : 'transparent'}
                                        >
                                          <div className="avatar-xs" style={{ width: '24px', height: '24px', fontSize: '0.65rem' }}>
                                            {String(m.prenom?.[0] || m.email[0]).toUpperCase()}{String(m.nom?.[0] || '').toUpperCase()}
                                          </div>
                                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>{m.prenom} {m.nom}</span>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                              {typeof m.role === 'string' ? m.role : m.role?.nom}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            )}
                          </div>
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

      {/* Side Panel Overlay */}
      <AnimatePresence>
        {selectedTask && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="panel-overlay"
              onClick={() => setSelectedTask(null)}
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="task-details-panel"
            >
              <div className="panel-header">
                <div className="header-top">
                  <span className="task-id">#{selectedTask.id_tache}</span>
                  <button className="close-panel" onClick={() => setSelectedTask(null)}>
                    <X size={20} />
                  </button>
                </div>
                <h2>{selectedTask.nom_t}</h2>
                <div className="task-meta-pills">
                  <span className="pill status-pill">{selectedTask.statut_t}</span>
                  <span 
                    className="pill priority-pill"
                    style={{ backgroundColor: `${getPriorityColor(selectedTask.priorite_t)}20`, color: getPriorityColor(selectedTask.priorite_t) }}
                  >
                    {TASK_PRIORITY_LABELS[normalizeTaskPriority(selectedTask.priorite_t)]}
                  </span>
                </div>
              </div>

              <div className="panel-content">
                <div className="content-section">
                  <label>Description</label>
                  <p>{selectedTask.description_t || 'Aucune description.'}</p>
                </div>

                <div className="content-grid">
                  <div className="grid-item">
                    <label>Échéance</label>
                    <div className="value-with-icon">
                      <CalendarClock size={16} />
                      <span>{selectedTask.date_limite_t ? new Date(selectedTask.date_limite_t).toLocaleDateString() : 'Non définie'}</span>
                    </div>
                  </div>
                  <div className="grid-item" style={{ position: 'relative' }}>
                    <label>Assigné à</label>
                    <div 
                      className="value-with-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isSuperAdmin) {
                          setAssigneeDropdownOpenId(assigneeDropdownOpenId === 'side_panel_assignee' ? null : 'side_panel_assignee');
                        }
                      }}
                      style={{ cursor: isSuperAdmin ? 'default' : 'pointer', padding: '4px', borderRadius: 'var(--radius-md)', transition: 'background 0.2s', marginLeft: '-4px' }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = isSuperAdmin ? 'transparent' : 'var(--bg-main)'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {selectedTask.utilisateur ? (
                        <>
                          <div className="avatar-sm">
                            {selectedTask.utilisateur.prenom[0]}{selectedTask.utilisateur.nom[0]}
                          </div>
                          <span>{selectedTask.utilisateur.prenom} {selectedTask.utilisateur.nom}</span>
                        </>
                      ) : (
                        <>
                          <UserIcon size={16} className="unassigned" />
                          <span className="unassigned">Non assigné</span>
                        </>
                      )}
                    </div>

                    {assigneeDropdownOpenId === 'side_panel_assignee' && (
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute', top: '100%', left: 0, minWidth: '240px',
                          background: 'var(--bg-surface)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-lg)', padding: '0.75rem',
                          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)', zIndex: 100,
                          maxHeight: '300px', overflowY: 'auto'
                        }}
                      >
                        <div className="search-box" style={{ marginBottom: '0.75rem', padding: '0.25rem 0.5rem', height: '32px' }}>
                          <Search size={14} />
                          <input 
                            type="text" 
                            placeholder="Chercher..." 
                            value={assigneeSearchQuery}
                            onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                            style={{ fontSize: '0.8rem' }}
                            autoFocus
                          />
                        </div>
                        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div 
                            onClick={() => handleAssignTask(selectedTask.id_tache.toString(), null)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem',
                              cursor: 'pointer', borderRadius: 'var(--radius-md)', transition: 'all 0.2s',
                              backgroundColor: !selectedTask.utilisateur ? 'var(--primary-light)' : 'transparent'
                            }}
                          >
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>Non assigné</span>
                          </div>
                          {teamMembers
                            .filter(m => {
                              if (!assigneeSearchQuery) return true;
                              const fullName = `${m.prenom} ${m.nom}`.toLowerCase();
                              return fullName.includes(assigneeSearchQuery.toLowerCase());
                            })
                            .map(m => {
                              const mId = m.id_utilisateur ?? m.id;
                              const isActive = selectedTask.assigne_a === mId;
                              return (
                                <div 
                                  key={mId}
                                  onClick={() => handleAssignTask(selectedTask.id_tache.toString(), Number(mId))}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem',
                                    cursor: 'pointer', borderRadius: 'var(--radius-md)', transition: 'all 0.2s',
                                    backgroundColor: isActive ? 'var(--primary-light)' : 'transparent'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-main)'}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = isActive ? 'var(--primary-light)' : 'transparent'}
                                >
                                  <div className="avatar-xs" style={{ width: '24px', height: '24px', fontSize: '0.65rem' }}>
                                    {String(m.prenom?.[0] || m.email[0]).toUpperCase()}{String(m.nom?.[0] || '').toUpperCase()}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>{m.prenom} {m.nom}</span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                      {typeof m.role === 'string' ? m.role : m.role?.nom}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="grid-item">
                    <label>Projet</label>
                    <div className="value-with-icon">
                      <Folder size={16} />
                      <span>{projectNameById.get(selectedTask.id_projet) || 'Projet'}</span>
                    </div>
                  </div>
                </div>

                <div className="tabs-section">
                  <div className="tabs-header">
                    <button className="tab active">Commentaires</button>
                    <button className="tab">Activité</button>
                    <button className="tab">Fichiers</button>
                  </div>
                  <div className="tab-content">
                    <div className="placeholder-state">
                      <Clock size={32} />
                      <p>L'historique et les commentaires seront bientôt disponibles.</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Tasks;
