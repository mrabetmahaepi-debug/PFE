import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Type,
  AlignLeft,
  Flag,
  Calendar,
  User,
  Loader2,
  Briefcase,
  ChevronDown,
  Search,
  Check,
} from 'lucide-react';
import { taskService } from '../services/task.service';
import { projectService } from '../services/project.service';
import type { User as WorkspaceUser } from '../types/auth.types';
import { TASK_PRIORITY_LABELS, TaskPriority, TaskStatus } from '../types/task';
import type { Projet } from '../types/project';
import {
  isoFromDateInput,
  validateTaskDateRange,
} from '../lib/taskDateValidation';
import {
  mapTaskCreateErrorMessage,
  resolveCreateTaskAssigneeId,
  shouldPickTaskAssigneeOnCreate,
} from '../lib/taskCreateAssignment';
import {
  normalizeProjectManageContext,
  type ProjectManageContext,
} from '../lib/projectManageAccess';
import { useAuth } from '../hooks/useAuth';
import './CreateTaskModal.css';

interface CreateTaskModalProps {
  isOpen: boolean;
  /**
   * Optional. When provided, pre-selects this project in the modal — typically
   * the project the user is currently viewing. The user can still change it
   * via the searchable picker.
   */
  projectId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  projectId,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [projectManageCtx, setProjectManageCtx] =
    useState<ProjectManageContext | null>(null);
  const [projectMemberIds, setProjectMemberIds] = useState<number[]>([]);
  const [formData, setFormData] = useState({
    nom_t: '',
    description_t: '',
    priorite_t: TaskPriority.MEDIUM,
    statut_t: TaskStatus.TODO as TaskStatus | 'en_retard',
    assigne_a: '',
    date_debut_t: '',
    date_limite_t: '',
  });
  const [projects, setProjects] = useState<Projet[]>([]);
  const [members, setMembers] = useState<WorkspaceUser[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || '');
  const [projectQuery, setProjectQuery] = useState('');
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const projectFieldRef = useRef<HTMLDivElement>(null);
  const assigneeFieldRef = useRef<HTMLDivElement>(null);

  // Reset form & preselect project from prop whenever the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setFormData({
      nom_t: '',
      description_t: '',
      priorite_t: TaskPriority.MEDIUM,
      statut_t: TaskStatus.TODO,
      assigne_a: '',
      date_debut_t: '',
      date_limite_t: '',
    });
    setSelectedProjectId(projectId || '');
    setProjectQuery('');
    setProjectMenuOpen(false);
    setAssigneeQuery('');
    setAssigneeMenuOpen(false);
    setError('');
    void fetchProjects();
  }, [isOpen, projectId]);

  // Outside-click closes the project combobox.
  useEffect(() => {
    if (!projectMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        projectFieldRef.current &&
        !projectFieldRef.current.contains(e.target as Node)
      ) {
        setProjectMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [projectMenuOpen]);

  useEffect(() => {
    if (!assigneeMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        assigneeFieldRef.current &&
        !assigneeFieldRef.current.contains(e.target as Node)
      ) {
        setAssigneeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [assigneeMenuOpen]);

  const fetchProjects = async () => {
    try {
      const projectData = await projectService.getAll();
      setProjects(Array.isArray(projectData) ? projectData : []);
    } catch (err) {
      console.error('Failed to fetch task dependencies:', err);
    }
  };

  useEffect(() => {
    if (!isOpen || !selectedProjectId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    void projectService
      .getById(selectedProjectId)
      .then((p) => {
        if (cancelled) return;
        const ctx = normalizeProjectManageContext(p);
        setProjectManageCtx(ctx);
        const team = Array.isArray(p.projectTeam) ? p.projectTeam : [];
        const mapped: WorkspaceUser[] = team
          .filter((m) => m.userId != null)
          .map((m) => ({
            id_utilisateur: m.userId!,
            email: m.email ?? '',
            prenom: m.prenom ?? '',
            nom: m.nom ?? '',
            role: m.roleProjet ?? 'Membre',
          }));
        setMembers(mapped);
        const ids = team
          .map((m) => Number(m.userId))
          .filter((id) => Number.isFinite(id) && id > 0);
        setProjectMemberIds(ids);
        const pick = shouldPickTaskAssigneeOnCreate(user, ctx);
        const uid =
          user?.id_utilisateur != null
            ? Number(user.id_utilisateur)
            : user?.id != null
              ? Number(user.id)
              : null;
        if (!pick && uid) {
          setFormData((prev) => ({ ...prev, assigne_a: String(uid) }));
        } else if (pick) {
          setFormData((prev) => ({ ...prev, assigne_a: '' }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMembers([]);
          setProjectManageCtx(null);
          setProjectMemberIds([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedProjectId, user]);

  const showAssigneePicker = shouldPickTaskAssigneeOnCreate(
    user,
    projectManageCtx
  );

  const filteredProjects = useMemo(() => {
    if (!projectQuery.trim()) return projects;
    const q = projectQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.nom_p?.toLowerCase().includes(q) ||
        p.entreprise?.nom?.toLowerCase().includes(q),
    );
  }, [projects, projectQuery]);

  const selectedProject = useMemo(
    () => projects.find((p) => String(p.id_projet) === selectedProjectId),
    [projects, selectedProjectId],
  );

  const filteredMembers = useMemo(() => {
    if (!assigneeQuery.trim()) return members;
    const q = assigneeQuery.toLowerCase();
    return members.filter((m) => {
      const fullName = `${m.prenom || ''} ${m.nom || ''}`.trim().toLowerCase();
      const roleName =
        typeof m.role === 'string'
          ? m.role.toLowerCase()
          : m.role?.nom?.toLowerCase() || '';
      return (
        fullName.includes(q) ||
        String(m.email || '').toLowerCase().includes(q) ||
        roleName.includes(q)
      );
    });
  }, [members, assigneeQuery]);

  const selectedAssignee = useMemo(
    () =>
      members.find(
        (m) => String(m.id_utilisateur ?? m.id) === formData.assigne_a,
      ),
    [members, formData.assigne_a],
  );

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectProject = (id: number) => {
    setSelectedProjectId(String(id));
    setProjectMenuOpen(false);
    setProjectQuery('');
  };

  const handleSelectAssignee = (id: string) => {
    setFormData((prev) => ({ ...prev, assigne_a: id }));
    setAssigneeMenuOpen(false);
    setAssigneeQuery('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setError('Veuillez sélectionner un projet.');
      return;
    }

    const dateErr = validateTaskDateRange(
      formData.date_debut_t,
      formData.date_limite_t
    );
    if (dateErr) {
      setError(dateErr);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      if (formData.statut_t === 'en_retard') {
        if (!formData.date_limite_t) {
          setError('Pour "En retard", renseignez une échéance passée.');
          setIsSubmitting(false);
          return;
        }
        const due = new Date(formData.date_limite_t);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (due >= today) {
          setError('Le statut "En retard" nécessite une échéance antérieure à aujourd’hui.');
          setIsSubmitting(false);
          return;
        }
      }
      const assigneeResult = resolveCreateTaskAssigneeId(
        user,
        projectManageCtx,
        formData.assigne_a,
        projectMemberIds
      );
      if ('error' in assigneeResult) {
        setError(assigneeResult.error);
        setIsSubmitting(false);
        return;
      }
      await taskService.create({
        nom_t: formData.nom_t,
        description_t: formData.description_t,
        priorite_t: formData.priorite_t,
        id_projet: parseInt(selectedProjectId),
        statut_t: formData.statut_t,
        assigne_a: assigneeResult.assigneeId,
        date_debut_t: isoFromDateInput(formData.date_debut_t),
        date_limite_t: isoFromDateInput(formData.date_limite_t),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      const raw =
        ax?.response?.data?.message || 'Erreur lors de la création de la tâche';
      setError(mapTaskCreateErrorMessage(raw));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="modal-overlay compact-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="modal-container compact-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header compact-modal-header">
              <div>
                <h2>Nouvelle tâche</h2>
                <p>Ajoutez une tâche à un de vos projets</p>
              </div>
              <button
                onClick={onClose}
                className="close-btn"
                aria-label="Fermer"
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form compact-modal-form">
              <div className="compact-modal-body">
              <div className="form-group">
                <label htmlFor="task-title">
                  Nom de la tâche <span className="required">*</span>
                </label>
                <div className="input-wrapper">
                  <Type className="input-icon" size={16} />
                  <input
                    id="task-title"
                    type="text"
                    name="nom_t"
                    placeholder="Ex : Designer le logo"
                    value={formData.nom_t}
                    onChange={handleChange}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="task-start">Date début</label>
                  <div className="input-wrapper">
                    <Calendar className="input-icon" size={16} />
                    <input
                      id="task-start"
                      type="date"
                      name="date_debut_t"
                      value={formData.date_debut_t}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="task-end">Date fin</label>
                  <div className="input-wrapper">
                    <Calendar className="input-icon" size={16} />
                    <input
                      id="task-end"
                      type="date"
                      name="date_limite_t"
                      value={formData.date_limite_t}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group" ref={projectFieldRef}>
                <label>
                  Projet <span className="required">*</span>
                </label>
                <div
                  className={`task-combobox ${projectMenuOpen ? 'open' : ''} ${
                    selectedProject ? 'has-value' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="task-combobox-trigger"
                    onClick={() => setProjectMenuOpen((v) => !v)}
                    aria-haspopup="listbox"
                    aria-expanded={projectMenuOpen}
                  >
                    <Briefcase size={16} className="input-icon" />
                    <span
                      className={`task-combobox-value ${
                        selectedProject ? '' : 'placeholder'
                      }`}
                    >
                      {selectedProject
                        ? selectedProject.nom_p
                        : 'Sélectionner un projet'}
                    </span>
                    <ChevronDown
                      size={14}
                      className="task-combobox-chevron"
                    />
                  </button>

                  {projectMenuOpen && (
                    <div className="task-combobox-menu" role="listbox">
                      <div className="task-combobox-search">
                        <Search size={14} />
                        <input
                          type="text"
                          placeholder="Rechercher un projet..."
                          value={projectQuery}
                          onChange={(e) => setProjectQuery(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div className="task-combobox-options">
                        {filteredProjects.length === 0 && (
                          <div className="task-combobox-empty">
                            Aucun projet trouvé
                          </div>
                        )}
                        {filteredProjects.map((p) => {
                          const isActive =
                            String(p.id_projet) === selectedProjectId;
                          return (
                            <button
                              type="button"
                              key={p.id_projet}
                              className={`task-combobox-option ${
                                isActive ? 'active' : ''
                              }`}
                              onClick={() => handleSelectProject(p.id_projet)}
                              role="option"
                              aria-selected={isActive}
                            >
                              <span className="option-label">
                                <span className="option-name">{p.nom_p}</span>
                                {p.entreprise?.nom && (
                                  <span className="option-meta">
                                    {p.entreprise.nom}
                                  </span>
                                )}
                              </span>
                              {isActive && <Check size={14} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="task-description">Description</label>
                <div className="input-wrapper">
                  <AlignLeft className="input-icon-top" size={16} />
                  <textarea
                    id="task-description"
                    name="description_t"
                    placeholder="Détails de la tâche (optionnel)"
                    value={formData.description_t}
                    onChange={handleChange}
                    rows={3}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="task-priority">Priorité</label>
                  <div className="input-wrapper">
                    <Flag className="input-icon" size={16} />
                    <select
                      id="task-priority"
                      name="priorite_t"
                      value={formData.priorite_t}
                      onChange={handleChange}
                    >
                      {Object.values(TaskPriority).map((value) => (
                        <option key={value} value={value}>
                          {TASK_PRIORITY_LABELS[value]}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="select-chevron" />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="task-status">Statut</label>
                  <div className="input-wrapper">
                    <Check className="input-icon" size={16} />
                    <select
                      id="task-status"
                      name="statut_t"
                      value={formData.statut_t}
                      onChange={handleChange}
                    >
                      <option value={TaskStatus.TODO}>À faire</option>
                      <option value={TaskStatus.IN_PROGRESS}>En cours</option>
                      <option value={TaskStatus.DONE}>Terminée</option>
                      <option value="en_retard">En retard</option>
                    </select>
                    <ChevronDown size={14} className="select-chevron" />
                  </div>
                </div>
              </div>

              {showAssigneePicker && (
              <div className="form-row">
                <div className="form-group" ref={assigneeFieldRef}>
                  <label>
                    Assigné à <span className="required">*</span>
                  </label>
                  <div
                    className={`task-combobox ${assigneeMenuOpen ? 'open' : ''} ${
                      selectedAssignee ? 'has-value' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="task-combobox-trigger"
                      onClick={() => setAssigneeMenuOpen((v) => !v)}
                      aria-haspopup="listbox"
                      aria-expanded={assigneeMenuOpen}
                    >
                      {selectedAssignee ? (
                        <div className="avatar-xs" style={{ width: '20px', height: '20px', fontSize: '0.6rem', border: 'none', flexShrink: 0 }}>
                          {selectedAssignee.prenom?.[0]}{selectedAssignee.nom?.[0]}
                        </div>
                      ) : (
                        <User size={16} className="input-icon" />
                      )}
                      <span
                        className={`task-combobox-value ${
                          selectedAssignee ? '' : 'placeholder'
                        }`}
                      >
                        {selectedAssignee
                          ? `${selectedAssignee.prenom || ''} ${selectedAssignee.nom || ''}`.trim() ||
                            selectedAssignee.email
                          : 'Choisir un membre du projet'}
                      </span>
                      <ChevronDown
                        size={14}
                        className="task-combobox-chevron"
                      />
                    </button>

                    {assigneeMenuOpen && (
                      <div className="task-combobox-menu" role="listbox">
                        <div className="task-combobox-search">
                          <Search size={14} />
                          <input
                            type="text"
                            placeholder="Rechercher un membre..."
                            value={assigneeQuery}
                            onChange={(e) => setAssigneeQuery(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className="task-combobox-options">
                          {filteredMembers.length === 0 && (
                            <div className="task-combobox-empty">
                              Aucun membre trouvé
                            </div>
                          )}
                          {filteredMembers.map((member) => {
                            const memberId = String(member.id_utilisateur ?? member.id);
                            const isActive = memberId === formData.assigne_a;
                            const roleLabel =
                              typeof member.role === 'string'
                                ? member.role
                                : member.role?.nom || member.poste || 'Membre';
                            const statusLabel = String(member.statut || '').toUpperCase() === 'PENDING'
                              ? 'Invité'
                              : 'Actif';
                            const displayName =
                              `${member.prenom || ''} ${member.nom || ''}`.trim() ||
                              member.email;
                            return (
                              <button
                                type="button"
                                key={memberId}
                                className={`task-combobox-option ${
                                  isActive ? 'active' : ''
                                }`}
                                onClick={() => handleSelectAssignee(memberId)}
                                role="option"
                                aria-selected={isActive}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem' }}
                              >
                                <div className="avatar-xs" style={{ width: '28px', height: '28px', fontSize: '0.75rem', border: 'none', backgroundColor: isActive ? 'white' : 'var(--primary)', color: isActive ? 'var(--primary)' : 'white' }}>
                                  {member.prenom?.[0]}{member.nom?.[0]}
                                </div>
                                <span className="option-label" style={{ flex: 1 }}>
                                  <span className="option-name">{displayName}</span>
                                  <span className="option-meta">
                                    {roleLabel}
                                  </span>
                                </span>
                                {isActive && <Check size={14} />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              )}

              {error && <p className="form-error">{error}</p>}
              </div>

              <div className="modal-footer compact-modal-footer">
                <button
                  type="button"
                  onClick={onClose}
                  className="secondary-btn"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={
                    isSubmitting ||
                    !selectedProjectId ||
                    (showAssigneePicker && !formData.assigne_a)
                  }
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    'Créer'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CreateTaskModal;
