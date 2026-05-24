import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Type, AlignLeft, Loader2 } from 'lucide-react';
import { hierarchyService } from '../services/hierarchy.service';
import { spaceService } from '../services/space.service';
import { sprintService } from '../services/sprint.service';
import { taskService } from '../services/task.service';
import { projectService } from '../services/project.service';
import { useAuth } from '../hooks/useAuth';
import { isGlobalMember } from '../lib/permissions';
import { TaskPriority, TaskStatus } from '../types/task';
import type { HierarchyLevel } from '../types/hierarchy';
import './CreateProjectModal.css';
import './MemberTaskCreateModal.css';
import ThemedDateField from './ThemedDateField';
import ThemedMemberSelect from './ThemedMemberSelect';
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
import {
  MEMBER_LIST_PRIORITY_OPTIONS,
  memberListPriorityLabel,
  taskPriorityToPillTone,
} from '../lib/memberStatusPill';

export interface HierarchyParentContext {
  id_projet: number;
  id_space?: number | null;
  id_sprint?: number | null;
  id_list?: number | null;
}

export interface CreatedHierarchyItem {
  level: HierarchyLevel;
  entity: any;
  parent: HierarchyParentContext;
}

export type TaskHierarchyOption = { id: number; label: string };

interface CreateHierarchyItemModalProps {
  isOpen: boolean;
  level: HierarchyLevel;
  parent: HierarchyParentContext | null;
  /** Task status key (e.g. todo, en_cours) or TaskStatus enum */
  defaultStatutKey?: string;
  /** Pre-fill due date (yyyy-mm-dd) when creating a task from calendar */
  defaultEndDate?: string;
  onClose: () => void;
  onSuccess: (created: CreatedHierarchyItem) => void;
  /** Optional sprint/list pickers when creating a task from the workspace. */
  taskListOptions?: TaskHierarchyOption[];
  taskSprintOptions?: TaskHierarchyOption[];
  onError?: (message: string) => void;
}

const LEVEL_TITLES: Record<HierarchyLevel, string> = {
  space: 'Espace',
  project: 'Projet',
  sprint: 'Sprint',
  list: 'Liste',
  task: 'Tâche',
};

const today = () => new Date().toISOString().split('T')[0];

function memberInitials(prenom: string, nom: string, email: string): string {
  const a = (prenom || '').trim()[0] || '';
  const b = (nom || '').trim()[0] || '';
  if (a || b) return `${a}${b}`.toUpperCase();
  return (email || '?').trim()[0]?.toUpperCase() || '?';
}

type ProjectTeamRow = {
  userId: number | null;
  email: string;
  prenom: string;
  nom: string;
  roleProjet: string;
};

const CreateHierarchyItemModal: React.FC<CreateHierarchyItemModalProps> = ({
  isOpen,
  level,
  parent,
  defaultStatutKey,
  defaultEndDate,
  onClose,
  onSuccess,
  taskListOptions = [],
  taskSprintOptions = [],
  onError,
}) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#4f46e5');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [projectTeam, setProjectTeam] = useState<ProjectTeamRow[]>([]);
  const [projectManageCtx, setProjectManageCtx] =
    useState<ProjectManageContext | null>(null);
  const [taskListId, setTaskListId] = useState<string>('__inherit');
  const [taskSprintId, setTaskSprintId] = useState<string>('__inherit');

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setDescription('');
    setColor('#4f46e5');
    setStartDate(today());
    setEndDate(
      defaultEndDate && /^\d{4}-\d{2}-\d{2}$/.test(defaultEndDate)
        ? defaultEndDate
        : today()
    );
    setPriority(TaskPriority.MEDIUM);
    setError('');
    setAssigneeId('');
    setProjectManageCtx(null);
    setTaskListId(
      parent?.id_list != null ? String(parent.id_list) : '__inherit'
    );
    setTaskSprintId(
      parent?.id_sprint != null ? String(parent.id_sprint) : '__inherit'
    );
    if (level === 'task' && parent?.id_projet) {
      void projectService
        .getById(parent.id_projet)
        .then((p) => {
          const ctx = normalizeProjectManageContext(p);
          setProjectManageCtx(ctx);
          const team = Array.isArray(p.projectTeam) ? p.projectTeam : [];
          const rows = team
            .filter((m) => m.userId != null)
            .map((m) => ({
              userId: m.userId,
              email: m.email ?? '',
              prenom: m.prenom ?? '',
              nom: m.nom ?? '',
              roleProjet: m.roleProjet?.trim() || 'Membre',
            }));
          setProjectTeam(rows);
          const pickAssignee = shouldPickTaskAssigneeOnCreate(user, ctx);
          const uid =
            user?.id_utilisateur != null
              ? Number(user.id_utilisateur)
              : user?.id != null
                ? Number(user.id)
                : null;
          if (!pickAssignee && uid) {
            setAssigneeId(String(uid));
          } else if (pickAssignee) {
            setAssigneeId('');
          }
        })
        .catch(() => {
          setProjectTeam([]);
          setProjectManageCtx(null);
        });
    } else {
      setProjectTeam([]);
      setProjectManageCtx(null);
    }
  }, [isOpen, level, parent, user, defaultEndDate]);

  const showAssigneePicker =
    level === 'task' &&
    shouldPickTaskAssigneeOnCreate(user, projectManageCtx);

  const isMemberTaskCreate =
    level === 'task' && isGlobalMember(user);

  const taskFieldGroupClass =
    isMemberTaskCreate ? 'form-group' : 'form-group form-group--accent';

  const memberSelectOptions = useMemo(
    () =>
      projectTeam.map((m) => {
        const label =
          `${m.prenom || ''} ${m.nom || ''}`.trim() || m.email || 'Membre';
        return {
          value: String(m.userId ?? ''),
          label,
          role: m.roleProjet,
          initials: memberInitials(m.prenom, m.nom, m.email),
        };
      }),
    [projectTeam]
  );

  if (!parent && level !== 'space') return null;

  const resolveTaskListId = (): number | null => {
    if (parent?.id_list != null) return Number(parent.id_list);
    if (!taskListOptions.length) return null;
    if (taskListId === '__inherit' || taskListId === '__none') return null;
    const n = Number(taskListId);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const resolveTaskSprintId = (): number | null => {
    if (parent?.id_sprint != null) return Number(parent.id_sprint);
    if (!taskSprintOptions.length) return null;
    if (taskSprintId === '__inherit' || taskSprintId === '__none') return null;
    const n = Number(taskSprintId);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parent && level !== 'space') return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Le nom est obligatoire');
      return;
    }
    if (level === 'task') {
      const listId = resolveTaskListId();
      if (!listId) {
        const msg =
          'Veuillez sélectionner une liste avant de créer une tâche';
        setError(msg);
        onError?.(msg);
        return;
      }
      const dateErr = validateTaskDateRange(startDate, endDate);
      if (dateErr) {
        setError(dateErr);
        onError?.(dateErr);
        return;
      }
    }
    if (level === 'sprint' && endDate < startDate) {
      setError('La date de fin ne peut pas être antérieure à la date de début.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      let entity: any = null;
      const ctx = parent ?? { id_projet: 0 };
      if (level === 'space') {
        entity = await spaceService.create({
          nom: trimmedName,
          description: description || undefined,
        });
      } else if (level === 'list') {
        if (!ctx.id_sprint) {
          setError('Sélectionnez un sprint pour créer une liste.');
          setSubmitting(false);
          return;
        }
        entity = await hierarchyService.createList({
          nom: trimmedName,
          description: description || undefined,
          id_projet: ctx.id_projet,
          id_sprint: ctx.id_sprint,
        });
      } else if (level === 'sprint') {
        entity = await sprintService.create({
          nom_s: trimmedName,
          date_debut_s: new Date(startDate).toISOString(),
          date_fin_s: new Date(endDate).toISOString(),
          id_projet: ctx.id_projet,
        });
      } else if (level === 'task') {
        const sprintId = resolveTaskSprintId();
        const listId = resolveTaskListId();
        if (!listId) {
          const msg =
            'Veuillez sélectionner une liste avant de créer une tâche';
          setError(msg);
          onError?.(msg);
          setSubmitting(false);
          return;
        }
        const memberIds = projectTeam
          .map((m) => Number(m.userId))
          .filter((id) => Number.isFinite(id) && id > 0);
        const assigneeResult = resolveCreateTaskAssigneeId(
          user,
          projectManageCtx,
          assigneeId,
          memberIds
        );
        if ('error' in assigneeResult) {
          setError(assigneeResult.error);
          onError?.(assigneeResult.error);
          setSubmitting(false);
          return;
        }
        const aid = assigneeResult.assigneeId;
        const resolvedStatut = defaultStatutKey?.trim() || 'todo';
        entity = await taskService.create({
          nom_t: trimmedName,
          title: trimmedName,
          description_t: description || '',
          description: description || '',
          priorite_t: priority,
          statut_t: resolvedStatut as TaskStatus,
          status: resolvedStatut,
          id_projet: ctx.id_projet,
          projectId: ctx.id_projet,
          id_sprint: sprintId,
          sprintId,
          id_list: listId,
          listId,
          spaceId: ctx.id_space ?? null,
          assigne_a: aid,
          assigneeId: aid,
          date_debut_t: isoFromDateInput(startDate),
          startDate: startDate || undefined,
          date_limite_t: isoFromDateInput(endDate),
          dueDate: isoFromDateInput(endDate),
          endDate: endDate || undefined,
        });
      }
      onSuccess({ level, entity, parent: ctx });
      onClose();
    } catch (err: any) {
      const raw =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Erreur lors de la création';
      const msg =
        typeof raw === 'string'
          ? mapTaskCreateErrorMessage(raw)
          : 'Erreur lors de la création';
      setError(msg);
      onError?.(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (typeof document === 'undefined') return null;

  const taskCanSubmit =
    level !== 'task' || (name.trim().length > 0 && resolveTaskListId() != null);

  const modalContent = (
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
            className={`modal-container compact-modal hierarchy-create-modal${
              isMemberTaskCreate ? ' member-task-create-modal' : ''
            }`}
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header compact-modal-header">
              <div>
                <h2>
                  {level === 'task'
                    ? 'Nouvelle tâche'
                    : `Nouveau ${LEVEL_TITLES[level]}`}
                </h2>
              </div>
              <button onClick={onClose} className="close-btn" aria-label="Fermer" type="button">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form compact-modal-form">
              <div className="compact-modal-body">
                <div className={level === 'task' ? taskFieldGroupClass : 'form-group form-group--accent'}>
                  <label>
                    {level === 'task' ? 'Nom de la tâche' : 'Nom'}
                  </label>
                  <div className="input-wrapper">
                    {!(level === 'task' && isMemberTaskCreate) ? (
                      <Type className="input-icon" size={16} />
                    ) : null}
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={
                        level === 'task'
                          ? isMemberTaskCreate
                            ? 'Saisir nom de tâche'
                            : 'Ex. : Créer l’interface login'
                          : `Nom du ${LEVEL_TITLES[level].toLowerCase()}`
                      }
                      required
                      autoFocus
                    />
                  </div>
                </div>

                {level === 'task' && (
                  <div className="form-row">
                    <div className={taskFieldGroupClass}>
                      <label>Date début</label>
                      <ThemedDateField
                        value={startDate}
                        onChange={setStartDate}
                        ariaLabel="Date de début de la tâche"
                        allowManualInput
                      />
                    </div>
                    <div className={taskFieldGroupClass}>
                      <label>Date fin</label>
                      <ThemedDateField
                        value={endDate}
                        onChange={setEndDate}
                        ariaLabel="Date de fin de la tâche"
                        allowManualInput
                      />
                    </div>
                  </div>
                )}

                {level === 'task' && isMemberTaskCreate && (
                  <div className="cu-member-task-field">
                    <label
                      className="cu-member-task-label"
                      htmlFor="hierarchy-member-task-priority"
                    >
                      Priorité
                    </label>
                    <div className="cu-member-task-select-wrap">
                      <select
                        id="hierarchy-member-task-priority"
                        className={`cu-member-task-input cu-member-task-select cu-member-task-select--${taskPriorityToPillTone(priority)}`}
                        value={priority}
                        disabled={submitting}
                        aria-label={`Priorité : ${memberListPriorityLabel(priority)}`}
                        onChange={(e) =>
                          setPriority(e.target.value as TaskPriority)
                        }
                      >
                        {MEMBER_LIST_PRIORITY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {(level === 'space' ||
                  level === 'list' ||
                  (level === 'task' && !isMemberTaskCreate)) && (
                  <div className="form-group form-group--accent">
                    <label>Description</label>
                    <div className="input-wrapper">
                      <AlignLeft className="input-icon-top" size={16} />
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optionnel"
                      />
                    </div>
                  </div>
                )}

                {level === 'task' && showAssigneePicker && (
                  <div className="form-group form-group--accent">
                    <label>
                      Assigné à <span className="required">*</span>
                    </label>
                    <ThemedMemberSelect
                      value={assigneeId}
                      options={memberSelectOptions}
                      onChange={setAssigneeId}
                      ariaLabel="Membre du projet assigné"
                    />
                  </div>
                )}

                {level === 'group' && (
                  <div className="form-group">
                    <label>Couleur</label>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      style={{ width: 56, height: 32, border: 'none', borderRadius: '4px' }}
                    />
                  </div>
                )}

                {level === 'sprint' && (
                  <div className="form-row">
                    <div className="form-group form-group--accent">
                      <label>Début</label>
                      <ThemedDateField
                        value={startDate}
                        onChange={setStartDate}
                        ariaLabel="Date de début du sprint"
                        required
                        allowManualInput
                      />
                    </div>
                    <div className="form-group form-group--accent">
                      <label>Fin</label>
                      <ThemedDateField
                        value={endDate}
                        onChange={setEndDate}
                        ariaLabel="Date de fin du sprint"
                        required
                        allowManualInput
                      />
                    </div>
                  </div>
                )}

                {error && <p className="form-error">{error}</p>}
              </div>

              <div className="modal-footer compact-modal-footer hierarchy-create-modal-footer">
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
                  disabled={submitting || !taskCanSubmit}
                >
                  {submitting ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : level === 'task' ? (
                    'Créer'
                  ) : (
                    `Créer ${LEVEL_TITLES[level].toLowerCase()}`
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

export default CreateHierarchyItemModal;
