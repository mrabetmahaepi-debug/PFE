import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flag,
  GitBranch,
  Hash,
  Link2,
  Loader2,
  MessageSquare,
  Sparkles,
  Tag,
  Timer,
  UserPlus,
  Users,
} from 'lucide-react';
import { taskService } from '../services/task.service';
import { hierarchyService } from '../services/hierarchy.service';
import { projectService } from '../services/project.service';
import { spaceService } from '../services/space.service';
import { appPaths, buildListPath } from '../lib/workspaceRoutes';
import { getStatusLabel, getStatusTone } from '../lib/listStatusStyles';
import { normalizeTaskStatutKey } from '../lib/listStatusGroups';
import {
  TASK_PRIORITY_LABELS,
  TaskPriority,
  type Tache,
} from '../types/task';
import type { ListStatusPM } from '../types/hierarchy';
import type { User } from '../types/auth.types';
import TaskAiPanel from '../components/TaskAiPanel';
import './TaskDetail.css';

type BreadcrumbCtx = {
  spaceName: string | null;
  spaceId: number | null;
  projectName: string | null;
  projectId: number | null;
  listName: string | null;
  listId: number | null;
  sprintId: number | null;
};

function toDateInput(raw?: string | null): string {
  if (!raw) return '';
  try {
    return String(raw).slice(0, 10);
  } catch {
    return '';
  }
}

function memberLabel(u: User): string {
  const name = `${u.prenom || ''} ${u.nom || ''}`.trim();
  return name || u.email || `Utilisateur #${u.id_utilisateur}`;
}

function memberInitials(u: User): string {
  const p = (u.prenom || '').trim()[0] || '';
  const n = (u.nom || '').trim()[0] || '';
  const init = (p + n).toUpperCase();
  if (init) return init.slice(0, 2);
  return (u.email || '?')[0].toUpperCase();
}

function assigneeInitials(task: Tache): string {
  if (!task.utilisateur) return '?';
  const p = (task.utilisateur.prenom || '').trim()[0] || '';
  const n = (task.utilisateur.nom || '').trim()[0] || '';
  const init = (p + n).toUpperCase();
  if (init) return init.slice(0, 2);
  return (task.utilisateur.email || '?')[0].toUpperCase();
}

/** ClickUp-style task details — route /tasks/:taskId */
const TaskDetailsPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  const [task, setTask] = useState<Tache | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbCtx>({
    spaceName: null,
    spaceId: null,
    projectName: null,
    projectId: null,
    listName: null,
    listId: null,
    sprintId: null,
  });
  const [statuses, setStatuses] = useState<ListStatusPM[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const loadTask = useCallback(async (id: number) => {
    const loaded = await taskService.getById(String(id));
    setTask(loaded);
    setTitle(loaded.nom_t || '');
    setDescription(loaded.description_t || '');

    let ctx: BreadcrumbCtx = {
      spaceName: null,
      spaceId: null,
      projectName: loaded.projet?.nom_p ?? null,
      projectId: loaded.id_projet ?? null,
      listName: null,
      listId: loaded.id_list ?? null,
      sprintId: loaded.id_sprint ?? null,
    };

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
        const spaceId = list.projet?.id_space;
        if (spaceId) {
          ctx.spaceId = spaceId;
          try {
            const { spaces } = await spaceService.getHierarchy();
            const space = spaces.find((s) => s.id_space === spaceId);
            ctx.spaceName = space?.nom ?? null;
          } catch {
            /* ignore */
          }
        }
        const statusRows = await hierarchyService.getListStatuses(loaded.id_list);
        setStatuses(statusRows);
      } catch {
        setStatuses([]);
      }
    } else {
      setStatuses([]);
    }

    setBreadcrumb(ctx);

    if (loaded.id_projet) {
      try {
        const team = await projectService.getTeamCandidates(loaded.id_projet);
        setMembers(Array.isArray(team) ? team : []);
      } catch {
        setMembers([]);
      }
    } else {
      setMembers([]);
    }

    return loaded;
  }, []);

  useEffect(() => {
    const id = taskId ? Number(taskId) : NaN;
    if (!Number.isFinite(id) || id <= 0) {
      setError('Tâche introuvable');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    void (async () => {
      try {
        await loadTask(id);
      } catch {
        setError('Impossible de charger la tâche');
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
      try {
        const updated = await taskService.update(String(task.id_tache), patch);
        setTask(updated);
        if (patch.nom_t !== undefined) setTitle(updated.nom_t || '');
        if (patch.description_t !== undefined) {
          setDescription(updated.description_t || '');
        }
      } catch {
        setError('Échec de la mise à jour');
      } finally {
        setSaving(false);
      }
    },
    [task]
  );

  const patchStatus = useCallback(
    async (statutKey: string) => {
      if (!task) return;
      setSaving(true);
      try {
        const updated = await taskService.patchStatus(String(task.id_tache), statutKey);
        setTask(updated);
      } catch {
        setError('Échec de la mise à jour du statut');
      } finally {
        setSaving(false);
      }
    },
    [task]
  );

  const statusKey = useMemo(
    () => (task ? normalizeTaskStatutKey(task.statut_t) : 'todo'),
    [task]
  );

  const statusTone = getStatusTone(statusKey);
  const statusLabel = getStatusLabel(statusKey, statuses);

  const listPath = useMemo(() => {
    if (!breadcrumb.listId) return null;
    if (breadcrumb.spaceId && breadcrumb.projectId) {
      return buildListPath(
        breadcrumb.spaceId,
        breadcrumb.projectId,
        breadcrumb.listId,
        breadcrumb.sprintId
      );
    }
    return appPaths.listView(breadcrumb.listId);
  }, [breadcrumb]);

  if (loading) {
    return (
      <div className="cu-task-page">
        <div className="cu-task-loading">
          <Loader2 size={22} className="animate-spin" aria-hidden />
          <span>Chargement de la tâche…</span>
        </div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="cu-task-page">
        <div className="cu-task-page-inner">
          <p className="cu-task-error-banner">{error || 'Tâche introuvable'}</p>
          <Link to={appPaths.projects} className="cu-task-back">
            <ArrowLeft size={16} />
            Retour aux projets
          </Link>
        </div>
      </div>
    );
  }

  if (!task) return null;

  return (
    <div className="cu-task-page">
      <div className="cu-task-page-inner">
        <div className="cu-task-topbar">
          <button
            type="button"
            className="cu-task-back"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={16} />
            Retour
          </button>
          {saving && (
            <span className="cu-task-saving">
              <Loader2 size={14} className="inline animate-spin" /> Enregistrement…
            </span>
          )}
        </div>

        {error ? <div className="cu-task-error-banner">{error}</div> : null}

        <nav aria-label="Fil d'Ariane">
          <ol className="cu-task-breadcrumb">
            {breadcrumb.spaceName && breadcrumb.spaceId ? (
              <li>
                <button
                  type="button"
                  className="cu-crumb-link"
                  onClick={() => navigate(appPaths.space(breadcrumb.spaceId!))}
                >
                  {breadcrumb.spaceName}
                </button>
                <ChevronRight size={14} className="cu-task-breadcrumb-sep" aria-hidden />
              </li>
            ) : null}
            {breadcrumb.projectName && breadcrumb.projectId ? (
              <li>
                <button
                  type="button"
                  className="cu-crumb-link"
                  onClick={() =>
                    breadcrumb.spaceId
                      ? navigate(
                          `${appPaths.space(breadcrumb.spaceId)}/folders/${breadcrumb.projectId}`
                        )
                      : navigate(appPaths.projects)
                  }
                >
                  {breadcrumb.projectName}
                </button>
                <ChevronRight size={14} className="cu-task-breadcrumb-sep" aria-hidden />
              </li>
            ) : null}
            {breadcrumb.listName && listPath ? (
              <li>
                <button
                  type="button"
                  className="cu-crumb-link"
                  onClick={() => navigate(listPath)}
                >
                  {breadcrumb.listName}
                </button>
                <ChevronRight size={14} className="cu-task-breadcrumb-sep" aria-hidden />
              </li>
            ) : null}
            <li>
              <span className="cu-crumb-current">{task.nom_t || 'Tâche'}</span>
            </li>
          </ol>
        </nav>

        <header className="cu-task-header">
          <div className="cu-task-header-meta">
            <span className="cu-task-type-badge">
              <CheckCircle2 size={14} aria-hidden />
              Tâche
            </span>
            <span className="cu-task-id-label">
              <Hash size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
              {task.id_tache}
            </span>
            <button
              type="button"
              className="cu-task-ai-btn"
              onClick={() => setAiPanelOpen(true)}
            >
              <Sparkles size={16} aria-hidden />
              Demander à l&apos;IA
            </button>
          </div>

          <input
            className="cu-task-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const trimmed = title.trim();
              if (trimmed && trimmed !== task.nom_t) {
                void patchTask({ nom_t: trimmed });
              }
            }}
            aria-label="Titre de la tâche"
          />

          <div className="cu-task-brain-bar">
            <Brain size={20} aria-hidden />
            <span>
              Demandez à Brain de rédiger une description, générer des sous-tâches ou
              trouver des tâches similaires
            </span>
          </div>
        </header>

        <div className="cu-task-details-grid">
          <div className="cu-task-col-left">
            <div className="cu-task-field">
              <span className="cu-task-field-label">
                <CheckCircle2 size={14} aria-hidden />
                Statut
              </span>
              <div className="cu-task-field-control">
                {statuses.length > 0 ? (
                  <select
                    className={`cu-task-select cu-task-status-pill cu-task-status-pill--${statusTone}`}
                    value={statusKey}
                    onChange={(e) => void patchStatus(e.target.value)}
                    aria-label="Statut"
                  >
                    {statuses.map((s) => (
                      <option key={s.statut_key} value={s.statut_key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={`cu-task-status-pill cu-task-status-pill--${statusTone}`}
                  >
                    {statusLabel}
                  </span>
                )}
              </div>
            </div>

            <div className="cu-task-field">
              <span className="cu-task-field-label">
                <Calendar size={14} aria-hidden />
                Dates
              </span>
              <div className="cu-task-field-control cu-task-dates-row">
                <input
                  type="date"
                  className="cu-task-input"
                  value={toDateInput(task.date_debut_t)}
                  onChange={(e) => {
                    const v = e.target.value;
                    void patchTask({
                      date_debut_t: v || null,
                    });
                  }}
                  aria-label="Date de début"
                />
                <ArrowRight size={16} className="cu-task-date-arrow" aria-hidden />
                <input
                  type="date"
                  className="cu-task-input"
                  value={toDateInput(task.date_limite_t)}
                  onChange={(e) => {
                    const v = e.target.value;
                    void patchTask({
                      date_limite_t: v || null,
                    });
                  }}
                  aria-label="Date d'échéance"
                />
              </div>
            </div>

            <div className="cu-task-field">
              <span className="cu-task-field-label">
                <Clock size={14} aria-hidden />
                Temps estimé
              </span>
              <div className="cu-task-field-control">
                <span className="cu-task-placeholder-btn">
                  <Timer size={14} aria-hidden />
                  Ajouter une estimation
                </span>
              </div>
            </div>

            <div className="cu-task-field">
              <span className="cu-task-field-label">
                <Tag size={14} aria-hidden />
                Étiquettes
              </span>
              <div className="cu-task-field-control">
                <span className="cu-task-placeholder-btn">
                  <Tag size={14} aria-hidden />
                  Ajouter des étiquettes
                </span>
              </div>
            </div>
          </div>

          <div className="cu-task-col-right">
            <div className="cu-task-field">
              <span className="cu-task-field-label">
                <Users size={14} aria-hidden />
                Assignés
              </span>
              <div className="cu-task-field-control cu-task-assignees">
                {task.utilisateur ? (
                  <span className="cu-task-avatar" title={assigneeInitials(task)}>
                    {assigneeInitials(task)}
                  </span>
                ) : null}
                <select
                  className="cu-task-select"
                  value={task.assigne_a ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    void patchTask({
                      assigne_a: v ? Number(v) : null,
                    });
                  }}
                  aria-label="Assigné"
                >
                  <option value="">Non assigné</option>
                  {members.map((m) => {
                    const mid = Number(m.id_utilisateur ?? m.id);
                    return (
                      <option key={mid} value={mid}>
                        {memberLabel(m)}
                      </option>
                    );
                  })}
                </select>
                <button type="button" className="cu-task-placeholder-btn" title="Inviter">
                  <UserPlus size={14} aria-hidden />
                </button>
              </div>
            </div>

            <div className="cu-task-field">
              <span className="cu-task-field-label">
                <Flag size={14} aria-hidden />
                Priorité
              </span>
              <div className="cu-task-field-control">
                <select
                  className={`cu-task-select cu-task-priority-flag cu-task-priority-flag--${task.priorite_t}`}
                  value={task.priorite_t ?? TaskPriority.MEDIUM}
                  onChange={(e) => {
                    void patchTask({
                      priorite_t: e.target.value as TaskPriority,
                    });
                  }}
                  aria-label="Priorité"
                >
                  {Object.entries(TASK_PRIORITY_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="cu-task-field">
              <span className="cu-task-field-label">
                <Timer size={14} aria-hidden />
                Suivre le temps
              </span>
              <div className="cu-task-field-control">
                <span className="cu-task-placeholder-btn">
                  <Timer size={14} aria-hidden />
                  Démarrer le suivi
                </span>
              </div>
            </div>

            <div className="cu-task-field">
              <span className="cu-task-field-label">
                <Link2 size={14} aria-hidden />
                Relations
              </span>
              <div className="cu-task-field-control">
                <span className="cu-task-placeholder-btn">
                  <GitBranch size={14} aria-hidden />
                  Ajouter une relation
                </span>
              </div>
            </div>
          </div>
        </div>

        <section className="cu-task-section">
          <h2 className="cu-task-section-title">Description</h2>
          <textarea
            className="cu-task-description-area"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              const trimmed = description.trim();
              if (trimmed !== (task.description_t || '').trim()) {
                void patchTask({ description_t: trimmed });
              }
            }}
            placeholder="Ajouter une description…"
            aria-label="Description de la tâche"
          />
        </section>

        <section className="cu-task-section">
          <div className="cu-task-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className={`cu-task-tab ${activeTab === 'comments' ? 'is-active' : ''}`}
              aria-selected={activeTab === 'comments'}
              onClick={() => setActiveTab('comments')}
            >
              <MessageSquare size={14} style={{ display: 'inline', marginRight: 6 }} />
              Commentaires
            </button>
            <button
              type="button"
              role="tab"
              className={`cu-task-tab ${activeTab === 'activity' ? 'is-active' : ''}`}
              aria-selected={activeTab === 'activity'}
              onClick={() => setActiveTab('activity')}
            >
              Activité
            </button>
          </div>
          <div className="cu-task-tab-panel" role="tabpanel">
            {activeTab === 'comments' ? (
              <p>Les commentaires seront bientôt disponibles.</p>
            ) : (
              <p>L&apos;historique d&apos;activité sera bientôt disponible.</p>
            )}
          </div>
        </section>
      </div>

      <TaskAiPanel
        isOpen={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        taskTitle={title}
        taskDescription={description}
        onApplyDescription={(text) => {
          setDescription(text);
          void patchTask({ description_t: text });
        }}
        onApplyTitle={(text) => {
          setTitle(text);
          void patchTask({ nom_t: text });
        }}
      />
    </div>
  );
};

export default TaskDetailsPage;
