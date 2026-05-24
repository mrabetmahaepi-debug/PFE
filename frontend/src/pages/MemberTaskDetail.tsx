import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Flag,
  Loader2,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import api from '../services/api';
import { taskService } from '../services/task.service';
import { hierarchyService } from '../services/hierarchy.service';
import { projectService } from '../services/project.service';
import { spaceService } from '../services/space.service';
import { appPaths, buildListPath } from '../lib/workspaceRoutes';
import { MON_ESPACE_NAME } from '../lib/monEspaceRoute';
import { MEMBER_DASHBOARD_PROJECT_NAME } from '../lib/memberDashboardNavigation';
import { isMemberGestionProjetProject } from '../lib/memberProjectOverview';
import { normalizeTaskStatutKey } from '../lib/listStatusGroups';
import {
  canAssignTasksInProject,
  canChangeTaskStatusForTask,
  canDeleteSubtasksInProject,
  canDeleteTaskComment,
  canEditTaskDetailFields,
  resolveEffectiveProjectPermissions,
} from '../lib/projectPermissions';
import {
  projectMemberDisplayLabel,
  type ProjectTeamMemberRow,
} from '../lib/projectTeamMembers';
import {
  memberStatusPillClass,
  memberWorkflowStatusLabel,
  statutKeyToPillTone,
  memberListPriorityValue,
  MEMBER_LIST_PRIORITY_OPTIONS,
  taskPriorityToPillTone,
} from '../lib/memberStatusPill';
import {
  formatActivityDate,
  formatTaskHistoryLine,
  taskCommentAuthorName,
} from '../lib/memberTaskActivity';
import { formatTaskCommentDate } from '../lib/formatTaskCommentDate';
import {
  dispatchWorkspaceRefresh,
  TASK_DELETED_EVENT,
  TASK_RENAMED_EVENT,
  type TaskDeletedDetail,
  type TaskRenamedDetail,
} from '../lib/workspaceEvents';
import { TaskPriority, type Tache } from '../types/task';
import {
  appendTaskComment,
  deleteTaskComment,
  normalizeTaskCommentFromApi,
  normalizeTaskCommentsFromApi,
  removeTaskCommentFromList,
} from '../lib/taskCommentApi';
import type { TaskComment, TaskHistoryEntry } from '../types/taskActivity';
import { useAuth } from '../hooks/useAuth';
import MemberTaskAiPanel from '../components/MemberTaskAiPanel';
import EditableSubtaskName from '../components/EditableSubtaskName';
import SubtaskDeleteButton from '../components/SubtaskDeleteButton';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import ThemedDateField from '../components/ThemedDateField';
import { validateTaskDateRange } from '../lib/taskDateValidation';
import {
  getPermissionDeniedMessage,
  permissionDeniedFromError,
} from '../lib/permissionDenied';
import '../styles/memberStatusPill.css';
import './MemberTaskDetail.css';

const WORKFLOW_KEYS = ['todo', 'en_cours', 'en_retard', 'terminee'] as const;

type BreadcrumbCtx = {
  monEspaceId: number | null;
  projectName: string | null;
  projectId: number | null;
  listName: string | null;
  listId: number | null;
  sprintId: number | null;
};

function toDateInput(raw?: string | null): string {
  if (!raw) return '';
  return String(raw).slice(0, 10);
}

const MemberTaskDetail: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [task, setTask] = useState<Tache | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbCtx>({
    monEspaceId: null,
    projectName: null,
    projectId: null,
    listName: null,
    listId: null,
    sprintId: null,
  });
  const [members, setMembers] = useState<ProjectTeamMemberRow[]>([]);
  const [projectPermissions, setProjectPermissions] = useState<string[]>([]);
  const [localProjectRole, setLocalProjectRole] = useState<string | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<number | null>(
    null
  );
  const [subtasks, setSubtasks] = useState<Tache[]>([]);
  const [subtasksOpen, setSubtasksOpen] = useState(true);
  const [descriptionOpen, setDescriptionOpen] = useState(true);
  const [creatingSubtasks, setCreatingSubtasks] = useState(false);
  const [dateErrors, setDateErrors] = useState<{
    debut?: string;
    fin?: string;
  }>({});

  const currentUserId = useMemo(
    () => Number(user?.id_utilisateur ?? user?.id ?? 0) || null,
    [user?.id_utilisateur, user?.id]
  );

  const effectivePermissions = useMemo(
    () =>
      resolveEffectiveProjectPermissions(
        projectPermissions,
        user?.permissions ?? []
      ),
    [projectPermissions, user?.permissions]
  );

  const canEditFields = useMemo(
    () =>
      task
        ? canEditTaskDetailFields(
            effectivePermissions,
            task,
            currentUserId
          )
        : false,
    [effectivePermissions, task, currentUserId]
  );

  const canAssignTask = useMemo(
    () => canAssignTasksInProject(effectivePermissions),
    [effectivePermissions]
  );

  const canDeleteSubtasks = useMemo(
    () => canDeleteSubtasksInProject(projectPermissions),
    [projectPermissions]
  );

  const canEditStatus = useCallback(
    (t: Tache) =>
      canChangeTaskStatusForTask(
        effectivePermissions,
        t,
        currentUserId,
        { localRole: localProjectRole ?? t.currentUserProjectRole ?? null }
      ),
    [effectivePermissions, currentUserId, localProjectRole]
  );

  const loadCommentsAndHistory = useCallback(async (id: number) => {
    const [cRaw, h] = await Promise.all([
      api
        .get<unknown>(`/tasks/${id}/comments`)
        .then((r) => normalizeTaskCommentsFromApi(r.data))
        .catch(() => [] as TaskComment[]),
      taskService.getHistory(id).catch(() => [] as TaskHistoryEntry[]),
    ]);
    setComments(cRaw);
    setHistory(h);
  }, []);

  const loadTask = useCallback(async (id: number) => {
    const loaded = await taskService.getById(String(id));
    setTask(loaded);
    setTitle(loaded.nom_t || '');
    setDescription(loaded.description_t || '');
    setSubtasks(loaded.subtasks ?? []);
    setSubtasksOpen(true);

    let ctx: BreadcrumbCtx = {
      monEspaceId: null,
      projectName: loaded.projet?.nom_p ?? null,
      projectId: loaded.id_projet ?? null,
      listName: null,
      listId: loaded.id_list ?? null,
      sprintId: loaded.id_sprint ?? null,
    };

    try {
      const { spaces } = await spaceService.getHierarchy();
      const monEspace = spaces.find(
        (s) => s.nom?.trim().toLowerCase() === MON_ESPACE_NAME.toLowerCase()
      );
      ctx.monEspaceId = monEspace?.id_space ?? spaces[0]?.id_space ?? null;
    } catch {
      /* ignore */
    }

    if (loaded.id_list) {
      try {
        const list = await hierarchyService.getListById(loaded.id_list);
        ctx = {
          ...ctx,
          listName: list.nom,
          projectName: list.projet?.nom_p ?? ctx.projectName,
          projectId: list.id_projet,
          sprintId: list.id_sprint ?? ctx.sprintId,
        };
      } catch {
        /* ignore */
      }
    }

    setBreadcrumb(ctx);

    if (loaded.currentUserPermissions?.length) {
      setProjectPermissions(loaded.currentUserPermissions);
    }
    if (loaded.currentUserProjectRole) {
      setLocalProjectRole(loaded.currentUserProjectRole);
    }

    const projectId = ctx.projectId ?? loaded.id_projet ?? null;
    if (projectId) {
      try {
        const project = await projectService.getById(projectId);
        setProjectPermissions(project.currentUserPermissions ?? []);
        setLocalProjectRole(project.currentUserProjectRole ?? null);
      } catch {
        if (!loaded.currentUserPermissions?.length) {
          setProjectPermissions([]);
        }
      }
      try {
        const team = await projectService.getProjectMembers(projectId);
        setMembers(team);
      } catch {
        setMembers([]);
      }
    } else {
      setMembers([]);
      if (!loaded.currentUserPermissions?.length) {
        setProjectPermissions([]);
      }
    }

    await loadCommentsAndHistory(id);
    return loaded;
  }, [loadCommentsAndHistory]);

  useEffect(() => {
    const id = taskId ? Number(taskId) : NaN;
    if (!Number.isFinite(id) || id <= 0) {
      setError('Tâche introuvable');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    setForbidden(false);
    void (async () => {
      try {
        await loadTask(id);
      } catch (err: unknown) {
        const ax = err as { response?: { status?: number } };
        if (ax?.response?.status === 403) {
          setForbidden(true);
          setError(permissionDeniedFromError(err));
        } else {
          setError('Impossible de charger la tâche');
        }
        setTask(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [taskId, loadTask]);

  const patchTask = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!task) return;
      setSaving(true);
      setError('');
      try {
        const updated = await taskService.update(String(task.id_tache), patch);
        setTask(updated);
        if (updated.currentUserPermissions?.length) {
          setProjectPermissions(updated.currentUserPermissions);
        }
        if (patch.nom_t !== undefined) setTitle(updated.nom_t || '');
        if (patch.description_t !== undefined) {
          setDescription(updated.description_t || '');
        }
        try {
          const h = await taskService.getHistory(task.id_tache);
          setHistory(h);
        } catch {
          /* history refresh optional */
        }
        dispatchWorkspaceRefresh();
      } catch (err: unknown) {
        const ax = err as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        setError(
          ax?.response?.data?.message ||
            ax?.message ||
            getPermissionDeniedMessage()
        );
      } finally {
        setSaving(false);
      }
    },
    [task]
  );

  const commitDateDebut = useCallback(
    (iso: string) => {
      if (!task) return;
      const endIso = toDateInput(task.date_limite_t);
      const rangeErr = validateTaskDateRange(iso, endIso);
      setDateErrors((prev) => ({
        ...prev,
        debut: undefined,
        fin: rangeErr || undefined,
      }));
      void patchTask({ date_debut_t: iso || null });
    },
    [patchTask, task]
  );

  const commitDateFin = useCallback(
    (iso: string) => {
      if (!task) return;
      const startIso = toDateInput(task.date_debut_t);
      const rangeErr = validateTaskDateRange(startIso, iso);
      if (rangeErr) {
        setDateErrors((prev) => ({ ...prev, fin: rangeErr, debut: undefined }));
        return;
      }
      setDateErrors((prev) => ({ ...prev, fin: undefined, debut: undefined }));
      void patchTask({ date_limite_t: iso || null });
    },
    [patchTask, task]
  );

  const patchStatus = useCallback(
    async (statutKey: string) => {
      if (!task || !canEditStatus(task)) return;
      setSaving(true);
      try {
        const updated = await taskService.patchStatus(
          String(task.id_tache),
          statutKey
        );
        setTask(updated);
        try {
          const h = await taskService.getHistory(task.id_tache);
          setHistory(h);
        } catch {
          /* history refresh optional */
        }
        dispatchWorkspaceRefresh();
      } catch (err: unknown) {
        const ax = err as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        setError(
          ax?.response?.data?.message ||
            ax?.message ||
            getPermissionDeniedMessage()
        );
      } finally {
        setSaving(false);
      }
    },
    [task, canEditStatus]
  );

  const sendComment = async () => {
    if (!task) return;
    const taskId = task.id_tache;
    const commentText = commentDraft.trim();
    if (!commentText) return;

    setPostingComment(true);
    setError('');

    try {
      const response = await api.post(
        `/tasks/${taskId}/comments`,
        { content: commentText }
      );

      const created = normalizeTaskCommentFromApi(response.data);
      setComments((prev) => appendTaskComment(prev, created));
      setCommentDraft('');
      setError('');

      try {
        const h = await taskService.getHistory(taskId);
        setHistory(h);
      } catch (historyErr) {
        console.warn('[MemberTaskDetail] history refresh failed', historyErr);
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setError(err.response?.data?.message || err.message || 'Erreur inconnue');
    } finally {
      setPostingComment(false);
    }
  };

  const handleSubtaskRenamed = useCallback((subtaskId: number, nom_t: string) => {
    setSubtasks((prev) =>
      prev.map((st) => (st.id_tache === subtaskId ? { ...st, nom_t } : st))
    );
  }, []);

  const handleSubtaskDeleted = useCallback((subtaskId: number) => {
    setSubtasks((prev) => prev.filter((st) => st.id_tache !== subtaskId));
  }, []);

  useEffect(() => {
    const onTaskRenamed = (e: Event) => {
      const detail = (e as CustomEvent<TaskRenamedDetail>).detail;
      if (!detail?.taskId || !detail.nom_t) return;
      handleSubtaskRenamed(detail.taskId, detail.nom_t);
    };
    window.addEventListener(TASK_RENAMED_EVENT, onTaskRenamed);
    return () => window.removeEventListener(TASK_RENAMED_EVENT, onTaskRenamed);
  }, [handleSubtaskRenamed]);

  useEffect(() => {
    const onTaskDeleted = (e: Event) => {
      const detail = (e as CustomEvent<TaskDeletedDetail>).detail;
      if (!detail?.taskId) return;
      handleSubtaskDeleted(detail.taskId);
      const currentId = Number(taskId);
      if (
        Number.isFinite(currentId) &&
        currentId === detail.taskId &&
        task?.id_parent_tache
      ) {
        navigate(appPaths.task(task.id_parent_tache));
      }
    };
    window.addEventListener(TASK_DELETED_EVENT, onTaskDeleted);
    return () => window.removeEventListener(TASK_DELETED_EVENT, onTaskDeleted);
  }, [handleSubtaskDeleted, navigate, task?.id_parent_tache, taskId]);

  const handleApplySubtasks = async (titles: string[]) => {
    if (!task) return;
    setCreatingSubtasks(true);
    setError('');
    try {
      const created = await taskService.createSubtasks(task.id_tache, titles);
      setSubtasks((prev) => [...prev, ...created]);
      setSubtasksOpen(true);
      dispatchWorkspaceRefresh();
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setError(
        ax.response?.data?.message ||
          ax.message ||
          'Impossible de créer les sous-tâches'
      );
    } finally {
      setCreatingSubtasks(false);
    }
  };

  const handleDeleteComment = (commentId: number) => {
    setPendingDeleteCommentId(commentId);
  };

  const executeDeleteComment = async () => {
    if (pendingDeleteCommentId == null) return;
    const commentId = pendingDeleteCommentId;
    setDeletingCommentId(commentId);
    setError('');
    try {
      await deleteTaskComment(commentId);
      setComments((prev) => removeTaskCommentFromList(prev, commentId));
      setPendingDeleteCommentId(null);
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setError(
        err.response?.data?.message ||
          err.message ||
          'Impossible de supprimer le commentaire'
      );
    } finally {
      setDeletingCommentId(null);
    }
  };

  const statusKey = useMemo(
    () => (task ? normalizeTaskStatutKey(task.statut_t) : 'todo'),
    [task]
  );
  const pillTone = statutKeyToPillTone(statusKey);
  const pillLabel = memberWorkflowStatusLabel(statusKey);

  const priorityValue = memberListPriorityValue(task?.priorite_t);
  const priorityTone = taskPriorityToPillTone(priorityValue);

  const listPath = useMemo(() => {
    if (!breadcrumb.listId || !breadcrumb.monEspaceId || !breadcrumb.projectId) {
      return breadcrumb.listId ? appPaths.listView(breadcrumb.listId) : null;
    }
    return buildListPath(
      breadcrumb.monEspaceId,
      breadcrumb.projectId,
      breadcrumb.listId,
      breadcrumb.sprintId
    );
  }, [breadcrumb]);

  const projectPath = useMemo(() => {
    if (breadcrumb.monEspaceId && breadcrumb.projectId) {
      return appPaths.folder(breadcrumb.monEspaceId, breadcrumb.projectId);
    }
    return null;
  }, [breadcrumb]);

  const showGestionProjetCrumb = isMemberGestionProjetProject(breadcrumb.projectName);

  if (loading) {
    return (
      <div className="mtd-loading">
        <Loader2 size={22} className="animate-spin" aria-hidden />
        <span>Chargement de la tâche…</span>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="mtd-page">
        <div
          className="mtd-inner"
          style={{ padding: '2rem', textAlign: 'center' }}
        >
          <h2 style={{ marginBottom: '0.5rem' }}>Accès refusé</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            {error || "Vous n'avez pas accès à cette tâche."}
          </p>
          <button type="button" className="primary-btn" onClick={() => navigate(-1)}>
            Retour
          </button>
        </div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="mtd-page">
        <div className="mtd-inner">
          <p className="mtd-error">{error || 'Tâche introuvable'}</p>
        </div>
      </div>
    );
  }

  if (!task) return null;

  const statusEditable = canEditStatus(task);

  return (
    <div className="mtd-page">
      <div className="mtd-inner">
        {saving ? (
          <div className="mtd-saving-bar" aria-live="polite">
            <span className="mtd-saving">
              <Loader2 size={14} className="animate-spin" aria-hidden />
              Enregistrement…
            </span>
          </div>
        ) : null}

        {error ? <div className="mtd-error">{error}</div> : null}

        <article className="mtd-card">
          <nav aria-label="Fil d'Ariane">
            <ol className="mtd-breadcrumb">
              {breadcrumb.monEspaceId ? (
                <li>
                  <button
                    type="button"
                    className="mtd-crumb-btn"
                    onClick={() => navigate(appPaths.space(breadcrumb.monEspaceId!))}
                  >
                    {MON_ESPACE_NAME}
                  </button>
                  <ChevronRight size={12} className="mtd-breadcrumb-sep" aria-hidden />
                </li>
              ) : null}
              {showGestionProjetCrumb && projectPath ? (
                <li>
                  <button
                    type="button"
                    className="mtd-crumb-btn"
                    onClick={() => navigate(projectPath)}
                  >
                    {MEMBER_DASHBOARD_PROJECT_NAME}
                  </button>
                  <ChevronRight size={12} className="mtd-breadcrumb-sep" aria-hidden />
                </li>
              ) : breadcrumb.projectName && projectPath ? (
                <li>
                  <button
                    type="button"
                    className="mtd-crumb-btn"
                    onClick={() => navigate(projectPath)}
                  >
                    {breadcrumb.projectName}
                  </button>
                  <ChevronRight size={12} className="mtd-breadcrumb-sep" aria-hidden />
                </li>
              ) : null}
              {breadcrumb.listName && listPath ? (
                <li>
                  <button
                    type="button"
                    className="mtd-crumb-btn"
                    onClick={() => navigate(listPath)}
                  >
                    {breadcrumb.listName}
                  </button>
                  <ChevronRight size={12} className="mtd-breadcrumb-sep" aria-hidden />
                </li>
              ) : null}
              <li>
                <span className="mtd-crumb-current">{task.nom_t || 'Tâche'}</span>
              </li>
            </ol>
          </nav>

          <div className="mtd-header-row">
            <span className="mtd-type-badge">
              <CheckCircle2 size={12} aria-hidden />
              Tâche
            </span>
            <button
              type="button"
              className="mtd-ai-btn"
              onClick={() => setAiPanelOpen(true)}
            >
              <Sparkles size={14} aria-hidden />
              Demander à l&apos;IA
            </button>
          </div>

          <input
            className="mtd-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const trimmed = title.trim();
              if (trimmed && trimmed !== task.nom_t && canEditFields) {
                void patchTask({ nom_t: trimmed });
              }
            }}
            readOnly={!canEditFields}
            aria-label="Titre de la tâche"
          />

          <div className="mtd-fields">
            <div className="mtd-field">
              <span className="mtd-field-label">
                <CheckCircle2 size={12} aria-hidden />
                Statut
              </span>
              {statusEditable ? (
                <div className="member-status-select-wrap">
                  <span className={memberStatusPillClass(pillTone)}>{pillLabel}</span>
                  <select
                    className="member-status-select-native"
                    value={statusKey}
                    disabled={saving}
                    onChange={(e) => void patchStatus(e.target.value)}
                    aria-label={`Statut : ${pillLabel}`}
                  >
                    {WORKFLOW_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {memberWorkflowStatusLabel(key)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className={memberStatusPillClass(pillTone)}>{pillLabel}</span>
              )}
            </div>

            <div className="mtd-field">
              <span className="mtd-field-label">
                <User size={12} aria-hidden />
                Assigné
              </span>
              <select
                className="mtd-select-native"
                value={task.assigne_a ?? ''}
                disabled={!canAssignTask || saving}
                onChange={(e) => {
                  const v = e.target.value;
                  void patchTask({ assigne_a: v ? Number(v) : null });
                }}
                aria-label="Assigné"
              >
                <option value="">Non assigné</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {projectMemberDisplayLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            <div className="mtd-field">
              <span className="mtd-field-label">
                <Calendar size={12} aria-hidden />
                Dates
              </span>
              <div className="mtd-dates">
                <ThemedDateField
                  className="mtd-date-field"
                  value={toDateInput(task.date_debut_t)}
                  onChange={commitDateDebut}
                  ariaLabel="Date de début"
                  allowManualInput
                  disabled={!canEditFields || saving}
                  error={dateErrors.debut}
                  onInvalidDate={(msg) =>
                    setDateErrors((prev) => ({ ...prev, debut: msg || undefined }))
                  }
                />
                <ArrowRight size={14} className="mtd-date-arrow" aria-hidden />
                <ThemedDateField
                  className="mtd-date-field"
                  value={toDateInput(task.date_limite_t)}
                  onChange={commitDateFin}
                  ariaLabel="Date d'échéance"
                  allowManualInput
                  disabled={!canEditFields || saving}
                  error={dateErrors.fin}
                  onInvalidDate={(msg) =>
                    setDateErrors((prev) => ({ ...prev, fin: msg || undefined }))
                  }
                />
              </div>
            </div>

            <div className="mtd-field">
              <span className="mtd-field-label">
                <Flag size={12} aria-hidden />
                Priorité
              </span>
              <select
                className={`mtd-select-native mtd-priority-select mtd-priority-select--${priorityTone}`}
                value={priorityValue}
                disabled={!canEditFields || saving}
                onChange={(e) => {
                  void patchTask({ priorite_t: e.target.value as TaskPriority });
                }}
                aria-label="Priorité"
              >
                {MEMBER_LIST_PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mtd-panels-grid">
            <section
              className={`mtd-panel-card mtd-panel-card--description${descriptionOpen ? ' is-expanded' : ''}`}
              aria-label="Description"
            >
              <button
                type="button"
                className="mtd-panel-header"
                aria-expanded={descriptionOpen}
                onClick={() => setDescriptionOpen((v) => !v)}
              >
                <h2 className="mtd-panel-title">Description</h2>
                <span className="mtd-panel-chevron" aria-hidden>
                  {descriptionOpen ? (
                    <ChevronDown size={16} strokeWidth={2} />
                  ) : (
                    <ChevronUp size={16} strokeWidth={2} />
                  )}
                </span>
              </button>
              <div
                className={`mtd-panel-collapse${descriptionOpen ? ' is-open' : ''}`}
              >
                <div className="mtd-panel-collapse-inner">
                  <div className="mtd-panel-body mtd-panel-body--description">
                    <textarea
                      className="mtd-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={() => {
                        const trimmed = description.trim();
                        if (
                          canEditFields &&
                          trimmed !== (task.description_t || '').trim()
                        ) {
                          void patchTask({ description_t: trimmed });
                        }
                      }}
                      readOnly={!canEditFields}
                      placeholder="Ajouter une description..."
                      aria-label="Description de la tâche"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section
              className={`mtd-panel-card${subtasksOpen ? ' is-expanded' : ''}`}
              aria-label="Sous-tâches"
            >
              <button
                type="button"
                className="mtd-panel-header"
                aria-expanded={subtasksOpen}
                onClick={() => setSubtasksOpen((v) => !v)}
              >
                <h2 className="mtd-panel-title">Sous-tâches</h2>
                {subtasks.length > 0 ? (
                  <span className="mtd-panel-count">{subtasks.length}</span>
                ) : null}
                <span className="mtd-panel-chevron" aria-hidden>
                  {subtasksOpen ? (
                    <ChevronDown size={16} strokeWidth={2} />
                  ) : (
                    <ChevronUp size={16} strokeWidth={2} />
                  )}
                </span>
              </button>
              <div
                className={`mtd-panel-collapse${subtasksOpen ? ' is-open' : ''}`}
              >
                <div className="mtd-panel-collapse-inner">
                  <div className="mtd-panel-body">
                {creatingSubtasks ? (
                  <p className="mtd-subtasks-hint">
                    <Loader2 size={14} className="animate-spin" aria-hidden />{' '}
                    Création des sous-tâches…
                  </p>
                ) : null}
                {subtasks.length === 0 && !creatingSubtasks ? (
                  <p className="mtd-empty mtd-subtasks-empty">
                    Aucune sous-tâche. Utilisez l&apos;assistant IA pour en générer.
                  </p>
                ) : (
                  <ul className="mtd-subtasks-tree">
                    {subtasks.map((st) => {
                      const stKey = normalizeTaskStatutKey(st.statut_t);
                      const stTone = statutKeyToPillTone(stKey);
                      const stLabel = memberWorkflowStatusLabel(stKey);
                      return (
                        <li key={st.id_tache} className="mtd-subtasks-item">
                          <div className="mtd-subtasks-item-row cu-pressable">
                            <div
                              className="mtd-subtasks-item-btn"
                              role="button"
                              tabIndex={0}
                              onClick={() => navigate(appPaths.task(st.id_tache))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  navigate(appPaths.task(st.id_tache));
                                }
                              }}
                            >
                              <span className="mtd-subtask-dot" aria-hidden />
                              <EditableSubtaskName
                                taskId={st.id_tache}
                                value={st.nom_t}
                                disabled={!canEditFields}
                                labelClassName="mtd-subtasks-item-name"
                                inputClassName="mtd-subtasks-item-input"
                                onRenamed={handleSubtaskRenamed}
                              />
                            </div>
                            <div className="mtd-subtasks-item-actions">
                              <span className={memberStatusPillClass(stTone)}>
                                {stLabel}
                              </span>
                              <SubtaskDeleteButton
                                taskId={st.id_tache}
                                taskName={st.nom_t}
                                disabled={!canDeleteSubtasks}
                                onDeleted={handleSubtaskDeleted}
                              />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="mtd-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className={`mtd-tab ${activeTab === 'comments' ? 'is-active' : ''}`}
              aria-selected={activeTab === 'comments'}
              onClick={() => setActiveTab('comments')}
            >
              Commentaires
            </button>
            <button
              type="button"
              role="tab"
              className={`mtd-tab ${activeTab === 'activity' ? 'is-active' : ''}`}
              aria-selected={activeTab === 'activity'}
              onClick={() => setActiveTab('activity')}
            >
              Activité
            </button>
          </div>

          {activeTab === 'comments' ? (
            <div role="tabpanel">
              <div className="mtd-comments-compose">
                <input
                  type="text"
                  className="mtd-comment-input"
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="Écrire un commentaire..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendComment();
                    }
                  }}
                />
                <button
                  type="button"
                  className="mtd-send-btn"
                  disabled={postingComment || !commentDraft.trim()}
                  onClick={() => void sendComment()}
                >
                  Envoyer
                </button>
              </div>
              {comments.length === 0 ? (
                <p className="mtd-empty">Aucun commentaire pour le moment.</p>
              ) : (
                <ul className="mtd-comments-list">
                  {comments.map((c) => {
                    const canDelete = canDeleteTaskComment(
                      projectPermissions,
                      c.utilisateur.id_utilisateur,
                      currentUserId
                    );
                    const isDeleting = deletingCommentId === c.id_comment;
                    return (
                      <li key={c.id_comment} className="mtd-comment-item">
                        <div className="mtd-comment-main">
                          <span className="mtd-comment-author">
                            {taskCommentAuthorName(c.utilisateur)}
                          </span>
                          <p className="mtd-comment-text">{c.contenu}</p>
                        </div>
                        <div className="mtd-comment-actions">
                          <time
                            className="mtd-comment-date"
                            dateTime={c.createdAt || undefined}
                          >
                            {formatTaskCommentDate(c.createdAt)}
                          </time>
                          {canDelete ? (
                            <button
                              type="button"
                              className="mtd-comment-delete"
                              title="Supprimer le commentaire"
                              aria-label="Supprimer le commentaire"
                              disabled={isDeleting}
                              onClick={() => void handleDeleteComment(c.id_comment)}
                            >
                              {isDeleting ? (
                                <Loader2
                                  size={14}
                                  className="animate-spin"
                                  aria-hidden
                                />
                              ) : (
                                <Trash2 size={14} strokeWidth={2} aria-hidden />
                              )}
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <div role="tabpanel">
              {history.length === 0 ? (
                <p className="mtd-empty">Aucune activité pour le moment.</p>
              ) : (
                <ul className="mtd-activity-list">
                  {history.map((entry) => (
                    <li key={entry.id_history} className="mtd-activity-item">
                      <p className="mtd-activity-line">
                        {formatTaskHistoryLine(entry)}
                      </p>
                      <div className="mtd-activity-meta">
                        {entry.utilisateur
                          ? taskCommentAuthorName(entry.utilisateur)
                          : 'Système'}
                        {' · '}
                        <time dateTime={entry.createdAt}>
                          {formatActivityDate(entry.createdAt)}
                        </time>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </article>
      </div>

      <MemberTaskAiPanel
        isOpen={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        taskId={task.id_tache}
        onApplyDescription={(text) => {
          setDescription(text);
          void patchTask({ description_t: text });
        }}
        onApplySubtasks={(items) => void handleApplySubtasks(items)}
      />

      <DeleteConfirmModal
        open={pendingDeleteCommentId != null}
        itemName="Commentaire"
        descriptionLine="Ce commentaire sera supprimé définitivement."
        loading={deletingCommentId != null}
        onCancel={() => {
          if (deletingCommentId != null) return;
          setPendingDeleteCommentId(null);
        }}
        onConfirm={() => void executeDeleteComment()}
      />
    </div>
  );
};

export default MemberTaskDetail;
