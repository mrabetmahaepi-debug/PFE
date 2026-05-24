import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FolderKanban, Loader2, RefreshCw, Sparkles, Users, X } from 'lucide-react';
import {
  actionTypeLabel,
  hasAutoApplySuggestions,
  isReassignmentStyleAction,
  type AdminApplyContext,
  type AdminApplyReassignment,
} from '../lib/adminRecommendationApply';
import type { AdminRecommendation } from '../lib/adminRecommendations';
import { ProjectStatus } from '../types/project';
import { projectService, buildCreateProjectRequestBody } from '../services/project.service';
import { sprintService } from '../services/sprint.service';
import { taskService } from '../services/task.service';
import { dispatchProjectTeamChanged } from '../lib/workspaceEvents';
import './AdminRecommendationApplyModal.css';

export type AdminRecommendationApplyModalProps = {
  isOpen: boolean;
  recommendation: AdminRecommendation | null;
  context: AdminApplyContext | null;
  loading?: boolean;
  onClose: () => void;
  onApplied: (summary: string, metadata?: Record<string, unknown>) => void;
  onViewTeam?: () => void;
  onViewProject?: () => void;
  onRetryAnalysis?: () => void;
};

const STATUS_OPTIONS = [
  { value: ProjectStatus.IN_PROGRESS, label: 'En cours' },
  { value: ProjectStatus.PLANNING, label: 'Planification' },
  { value: ProjectStatus.ON_HOLD, label: 'En pause' },
  { value: ProjectStatus.DELAYED, label: 'En retard' },
];

const AdminRecommendationApplyModal: React.FC<AdminRecommendationApplyModalProps> = ({
  isOpen,
  recommendation,
  context,
  loading = false,
  onClose,
  onApplied,
  onViewTeam,
  onViewProject,
  onRetryAnalysis,
}) => {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [taskAssignees, setTaskAssignees] = useState<Record<number, number>>({});
  const [reassignments, setReassignments] = useState<AdminApplyReassignment[]>([]);
  const [sprintName, setSprintName] = useState('');
  const [sprintStart, setSprintStart] = useState('');
  const [sprintEnd, setSprintEnd] = useState('');
  const [projectEndDate, setProjectEndDate] = useState('');
  const [projectStatus, setProjectStatus] = useState(ProjectStatus.IN_PROGRESS);

  useEffect(() => {
    if (!isOpen || !context) return;
    setError('');
    setSubmitting(false);
    setSelectedProjectId(
      context.projectId ?? context.suggestedProjects[0]?.id ?? ''
    );
    setSelectedMemberIds(
      context.memberId && context.actionType === 'assign_member'
        ? [context.memberId]
        : []
    );
    setTaskAssignees({});
    setReassignments(context.suggestedReassignments ?? []);
    setSprintName(context.suggestedSprint?.name ?? '');
    setSprintStart(context.suggestedSprint?.dateDebut ?? '');
    setSprintEnd(context.suggestedSprint?.dateFin ?? '');
    setProjectEndDate(context.project?.dateFin ?? '');
    setProjectStatus(
      (context.suggestedStatus as typeof ProjectStatus.IN_PROGRESS) ??
        ProjectStatus.IN_PROGRESS
    );
  }, [isOpen, context]);

  const actionType = context?.actionType ?? recommendation?.actionType ?? 'open_portfolio';

  const noAutoApply = Boolean(
    context &&
      isReassignmentStyleAction(actionType) &&
      !hasAutoApplySuggestions(context)
  );

  const membersToAdd = useMemo(() => {
    if (!context) return [];
    const onTeam = new Set(context.project?.teamMemberIds ?? []);
    return context.teamCandidates.filter((m) => !onTeam.has(m.id));
  }, [context]);

  const toggleMember = (id: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const applyTeamUpdate = useCallback(
    async (projectId: number, extraUserIds: number[]) => {
      const project = await projectService.getById(projectId);
      const chefId =
        project.chef_de_projet_id ??
        (project as { chef_id?: number }).chef_id ??
        extraUserIds[0];
      if (!chefId) throw new Error('Chef de projet introuvable pour ce projet.');

      const existing = (project.projectTeam ?? [])
        .filter((m) => m.userId != null && Number(m.userId) !== Number(chefId))
        .map((m) => ({
          userId: Number(m.userId),
          projectRole: m.roleProjet || 'Membre',
        }));

      const mergedIds = new Set(existing.map((m) => m.userId));
      for (const uid of extraUserIds) {
        if (!mergedIds.has(uid)) {
          existing.push({ userId: uid, projectRole: 'Membre' });
          mergedIds.add(uid);
        }
      }

      const today = new Date().toISOString().split('T')[0];
      const payload = buildCreateProjectRequestBody({
        nom_p: project.nom_p,
        description_p: project.description_p ?? '',
        date_debut: project.date_debut?.slice(0, 10) ?? today,
        date_fin: project.date_fin?.slice(0, 10) ?? today,
        chefId: Number(chefId),
        extraMembers: existing,
      });
      await projectService.updateTeam(projectId, payload);
      dispatchProjectTeamChanged({ projectId });
      window.dispatchEvent(new CustomEvent('projects:updated'));
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recommendation || !context) return;
    setSubmitting(true);
    setError('');

    try {
      if (actionType === 'assign_member') {
        const pid = Number(selectedProjectId);
        if (!pid) throw new Error('Sélectionnez un projet.');
        if (selectedMemberIds.length === 0) {
          throw new Error('Sélectionnez au moins un membre à affecter.');
        }
        await applyTeamUpdate(pid, selectedMemberIds);
        onApplied(
          `${selectedMemberIds.length} membre(s) ajouté(s) au projet.`,
          { projectId: pid, memberIds: selectedMemberIds }
        );
        return;
      }

      if (actionType === 'review_tasks') {
        const updates = Object.entries(taskAssignees).filter(
          ([, uid]) => Number(uid) > 0
        );
        if (updates.length === 0) {
          throw new Error('Choisissez au moins une réassignation de tâche.');
        }
        const reassignments = updates.map(([taskId, uid]) => {
          const task = context.overdueTasks.find((t) => t.id === Number(taskId));
          const toMember = context.teamCandidates.find((m) => m.id === Number(uid));
          return {
            taskId: Number(taskId),
            taskName: task?.name ?? `Tâche #${taskId}`,
            fromMemberId: task?.assigneeId ?? 0,
            fromMemberName: task?.assigneeName ?? 'Non assignée',
            toMemberId: Number(uid),
            toMemberName: toMember?.name ?? `Membre #${uid}`,
          };
        });
        await Promise.all(
          updates.map(([taskId, uid]) => taskService.assign(taskId, Number(uid)))
        );
        onApplied(`${updates.length} tâche(s) réassignée(s).`, {
          taskIds: updates.map(([id]) => Number(id)),
          reassignments,
        });
        return;
      }

      if (actionType === 'redistribute_workload') {
        if (reassignments.length === 0) {
          throw new Error('Aucune réassignation suggérée disponible.');
        }
        await Promise.all(
          reassignments.map((r) => taskService.assign(r.taskId, r.toMemberId))
        );
        onApplied(`${reassignments.length} tâche(s) redistribuée(s).`, {
          reassignments,
        });
        return;
      }

      if (actionType === 'create_sprint') {
        const pid = context.projectId ?? Number(selectedProjectId);
        if (!pid || !sprintName.trim()) {
          throw new Error('Nom du sprint et projet requis.');
        }
        await sprintService.create({
          nom_s: sprintName.trim(),
          date_debut_s: sprintStart,
          date_fin_s: sprintEnd,
          id_projet: pid,
        });
        if (projectEndDate && context.project?.dateFin !== projectEndDate) {
          await projectService.update(pid, {
            date_fin: new Date(`${projectEndDate}T12:00:00`).toISOString(),
          });
        }
        onApplied(`Sprint « ${sprintName.trim()} » créé.`, {
          projectId: pid,
          sprintName: sprintName.trim(),
          sprintStart,
          sprintEnd,
          dateFin: projectEndDate || undefined,
        });
        return;
      }

      if (actionType === 'update_timeline') {
        const pid = context.projectId;
        if (!pid) throw new Error('Projet introuvable.');
        await projectService.update(pid, {
          date_fin: new Date(`${projectEndDate}T12:00:00`).toISOString(),
        });
        onApplied('Échéance du projet mise à jour.', { projectId: pid, dateFin: projectEndDate });
        return;
      }

      if (actionType === 'update_project_status') {
        const pid = context.projectId;
        if (!pid) throw new Error('Projet introuvable.');
        await projectService.update(pid, { statut_p: projectStatus, status: projectStatus });
        onApplied(`Statut du projet mis à jour (${projectStatus}).`, {
          projectId: pid,
          status: projectStatus,
        });
        return;
      }

      throw new Error('Action non prise en charge dans cette fenêtre.');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'application.");
    } finally {
      setSubmitting(false);
    }
  };

  if (typeof document === 'undefined' || !isOpen) return null;

  const title = recommendation?.title ?? 'Appliquer la recommandation';

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="admin-rec-apply-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.div
            className="admin-rec-apply-modal"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onMouseDown={(ev) => ev.stopPropagation()}
            role="dialog"
            aria-labelledby="admin-rec-apply-title"
          >
            <header className="admin-rec-apply-head">
              <div>
                <p className="admin-rec-apply-kicker">{actionTypeLabel(actionType)}</p>
                <h2 id="admin-rec-apply-title">{title}</h2>
              </div>
              <button type="button" className="admin-rec-apply-close" onClick={onClose} aria-label="Fermer">
                <X size={18} />
              </button>
            </header>

            {loading || !context ? (
              <div className="admin-rec-apply-loading">
                <Loader2 className="admin-rec-apply-spin" size={28} />
                <p>Préparation de l&apos;action…</p>
              </div>
            ) : (
              <form className="admin-rec-apply-body" onSubmit={handleSubmit}>
                {noAutoApply ? (
                  <motion.div
                    className="admin-rec-apply-empty"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <motion.div
                      className="admin-rec-apply-empty-icon"
                      aria-hidden
                      animate={{ scale: [1, 1.04, 1] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <Sparkles size={22} strokeWidth={1.75} />
                    </motion.div>
                    <p className="admin-rec-apply-empty-title">
                      Aucune action automatique disponible actuellement.
                    </p>
                    <p className="admin-rec-apply-empty-sub">
                      Aucun membre disponible ou aucune redistribution pertinente détectée.
                    </p>
                    <motion.div
                      className="admin-rec-apply-empty-actions"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.08, duration: 0.2 }}
                    >
                      {onViewTeam ? (
                        <button
                          type="button"
                          className="admin-rec-apply-alt-btn"
                          onClick={onViewTeam}
                        >
                          <Users size={14} aria-hidden />
                          Voir équipe
                        </button>
                      ) : null}
                      {onViewProject ? (
                        <button
                          type="button"
                          className="admin-rec-apply-alt-btn"
                          onClick={onViewProject}
                        >
                          <FolderKanban size={14} aria-hidden />
                          Voir projet
                        </button>
                      ) : null}
                      {onRetryAnalysis ? (
                        <button
                          type="button"
                          className="admin-rec-apply-alt-btn admin-rec-apply-alt-btn--primary"
                          onClick={onRetryAnalysis}
                        >
                          <RefreshCw size={14} aria-hidden />
                          Réessayer analyse IA
                        </button>
                      ) : null}
                    </motion.div>
                  </motion.div>
                ) : (
                  <p className="admin-rec-apply-desc">{recommendation?.suggestedAction}</p>
                )}

                {!noAutoApply && actionType === 'assign_member' && (
                  <>
                    <label className="admin-rec-apply-field">
                      <span>Projet cible</span>
                      <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(Number(e.target.value) || '')}
                      >
                        <option value="">— Choisir —</option>
                        {context.suggestedProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.openTasks} tâches ouvertes)
                          </option>
                        ))}
                      </select>
                    </label>
                    <fieldset className="admin-rec-apply-checklist">
                      <legend>Membres à affecter</legend>
                      {context.member ? (
                        <label className="admin-rec-apply-check">
                          <input
                            type="checkbox"
                            checked={selectedMemberIds.includes(context.member.id)}
                            onChange={() => toggleMember(context.member!.id)}
                          />
                          <span>
                            {context.member.name} (recommandé)
                          </span>
                        </label>
                      ) : null}
                      {membersToAdd
                        .filter((m) => m.id !== context.memberId)
                        .slice(0, 12)
                        .map((m) => (
                          <label key={m.id} className="admin-rec-apply-check">
                            <input
                              type="checkbox"
                              checked={selectedMemberIds.includes(m.id)}
                              onChange={() => toggleMember(m.id)}
                            />
                            <span>
                              {m.name} — {m.openTasks} tâche(s) ouverte(s)
                            </span>
                          </label>
                        ))}
                    </fieldset>
                  </>
                )}

                {!noAutoApply && actionType === 'review_tasks' && (
                  <div className="admin-rec-apply-task-list">
                    {context.overdueTasks.length === 0 ? (
                      <p className="admin-rec-apply-muted">Aucune tâche en retard à réassigner.</p>
                    ) : (
                      context.overdueTasks.map((task) => (
                        <div key={task.id} className="admin-rec-apply-task-row">
                          <div>
                            <strong>{task.name}</strong>
                            <span>
                              {task.projectName}
                              {task.dueDate ? ` · échéance ${task.dueDate}` : ''}
                            </span>
                          </div>
                          <select
                            value={taskAssignees[task.id] ?? ''}
                            onChange={(e) => {
                              const uid = Number(e.target.value);
                              setTaskAssignees((prev) => {
                                const next = { ...prev };
                                if (!uid) {
                                  delete next[task.id];
                                  return next;
                                }
                                next[task.id] = uid;
                                return next;
                              });
                            }}
                          >
                            <option value="">— Réassigner à —</option>
                            {context.teamCandidates.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.openTasks} tâches)
                              </option>
                            ))}
                          </select>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {!noAutoApply && actionType === 'redistribute_workload' && (
                  <ul className="admin-rec-apply-reassign-list">
                    {reassignments.length === 0 ? (
                      <li className="admin-rec-apply-muted">Aucune suggestion de redistribution.</li>
                    ) : (
                      reassignments.map((r) => (
                        <li key={r.taskId}>
                          <strong>{r.taskName}</strong>
                          <span>
                            {r.fromMemberName} → {r.toMemberName}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                )}

                {!noAutoApply &&
                  (actionType === 'create_sprint' || actionType === 'update_timeline') && (
                  <>
                    {actionType === 'create_sprint' && (
                      <>
                        <label className="admin-rec-apply-field">
                          <span>Nom du sprint</span>
                          <input
                            type="text"
                            value={sprintName}
                            onChange={(e) => setSprintName(e.target.value)}
                            required
                          />
                        </label>
                        <div className="admin-rec-apply-row">
                          <label className="admin-rec-apply-field">
                            <span>Début</span>
                            <input
                              type="date"
                              value={sprintStart}
                              onChange={(e) => setSprintStart(e.target.value)}
                              required
                            />
                          </label>
                          <label className="admin-rec-apply-field">
                            <span>Fin</span>
                            <input
                              type="date"
                              value={sprintEnd}
                              onChange={(e) => setSprintEnd(e.target.value)}
                              required
                            />
                          </label>
                        </div>
                        <label className="admin-rec-apply-field">
                          <span>Nouvelle échéance du projet (optionnel)</span>
                          <input
                            type="date"
                            value={projectEndDate}
                            onChange={(e) => setProjectEndDate(e.target.value)}
                          />
                        </label>
                      </>
                    )}
                    {actionType === 'update_timeline' && (
                      <label className="admin-rec-apply-field">
                        <span>Nouvelle date de fin du projet</span>
                        <input
                          type="date"
                          value={projectEndDate}
                          onChange={(e) => setProjectEndDate(e.target.value)}
                          required
                        />
                      </label>
                    )}
                  </>
                )}

                {!noAutoApply && actionType === 'update_project_status' && (
                  <label className="admin-rec-apply-field">
                    <span>Nouveau statut</span>
                    <select
                      value={projectStatus}
                      onChange={(e) => setProjectStatus(e.target.value)}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {error ? <p className="admin-rec-apply-error">{error}</p> : null}

                <footer className="admin-rec-apply-foot">
                  <button type="button" className="admin-rec-btn admin-rec-btn--ghost" onClick={onClose}>
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="admin-rec-btn admin-rec-btn--apply"
                    disabled={submitting || noAutoApply}
                    title={
                      noAutoApply
                        ? 'Aucune action automatique disponible pour cette recommandation.'
                        : undefined
                    }
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="admin-rec-apply-spin" size={16} /> Application…
                      </>
                    ) : (
                      'Confirmer et appliquer'
                    )}
                  </button>
                </footer>
              </form>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};

export default AdminRecommendationApplyModal;
