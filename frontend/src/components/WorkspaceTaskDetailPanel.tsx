import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Calendar, User, Loader2 } from 'lucide-react';
import { TaskStatus, type Tache } from '../types/task';
import { taskService } from '../services/task.service';
import './WorkspaceTaskDetailPanel.css';

const STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'À faire',
  [TaskStatus.IN_PROGRESS]: 'En cours',
  [TaskStatus.DONE]: 'Terminée',
};

const formatDue = (raw?: string | null) => {
  if (!raw) return '—';
  try {
    return new Date(raw).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '—';
  }
};

interface WorkspaceTaskDetailPanelProps {
  task: Tache | null;
  open: boolean;
  listLabel?: string;
  canEdit: boolean;
  onClose: () => void;
  onSaved?: (task: Tache) => void;
}

const WorkspaceTaskDetailPanel: React.FC<WorkspaceTaskDetailPanelProps> = ({
  task,
  open,
  listLabel,
  canEdit,
  onClose,
  onSaved,
}) => {
  const [descDraft, setDescDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) setDescDraft(task.description_t || '');
  }, [task?.id_tache, task?.description_t]);

  if (!task) return null;

  const assignee = task.utilisateur
    ? `${task.utilisateur.prenom || ''} ${task.utilisateur.nom || ''}`.trim() ||
      task.utilisateur.email
    : 'Non assigné';

  const handleSaveDescription = async () => {
    if (!canEdit || descDraft === (task.description_t || '')) return;
    setSaving(true);
    try {
      const updated = await taskService.update(String(task.id_tache), {
        description_t: descDraft,
      });
      onSaved?.(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {open && (
        <motion.div
          className="ws-task-panel-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          aria-hidden
        />
      )}
      <motion.aside
        className="ws-task-panel"
        initial={false}
        animate={{
          x: open ? 0 : '100%',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws-task-panel-title"
      >
        <header className="ws-task-panel-header">
          <div className="ws-task-panel-header-row">
            <h2 id="ws-task-panel-title" className="ws-task-panel-heading">
              Détails de la tâche
            </h2>
            <button
              type="button"
              className="ws-task-panel-close"
              onClick={onClose}
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="ws-task-panel-body">
          <p className="ws-task-panel-codage">{task.nom_t}</p>
          {listLabel && (
            <p className="ws-task-panel-list">Liste · {listLabel}</p>
          )}

          <section className="ws-task-section">
            <h3>Description</h3>
            {canEdit ? (
              <>
                <textarea
                  className="ws-task-textarea"
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  onBlur={() => void handleSaveDescription()}
                  rows={4}
                  placeholder="Ajouter une description…"
                />
                {saving && (
                  <span className="ws-task-saving">
                    <Loader2 size={12} className="animate-spin" /> Enregistrement…
                  </span>
                )}
              </>
            ) : (
              <p className="ws-task-readonly">
                {task.description_t || 'Aucune description.'}
              </p>
            )}
          </section>

          <section className="ws-task-section ws-task-meta-grid">
            <div>
              <span className="ws-task-label">
                <Calendar size={12} /> Échéance
              </span>
              <p>{formatDue(task.date_limite_t)}</p>
            </div>
            <div>
              <span className="ws-task-label">
                <User size={12} /> Assigné
              </span>
              <p>{assignee}</p>
            </div>
            <div>
              <span className="ws-task-label">Statut</span>
              <p>{STATUS_LABELS[task.statut_t] || task.statut_t}</p>
            </div>
          </section>
        </div>
      </motion.aside>
    </>
  );
};

export default WorkspaceTaskDetailPanel;
