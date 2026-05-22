import React from 'react';
import { Trash2, X } from 'lucide-react';
import './TaskDeleteConfirmModal.css';

export interface TaskDeleteConfirmModalProps {
  open: boolean;
  taskName: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const TaskDeleteConfirmModal: React.FC<TaskDeleteConfirmModalProps> = ({
  open,
  taskName,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="task-delete-modal-overlay"
      role="presentation"
      onClick={() => !loading && onCancel()}
    >
      <div
        className="task-delete-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-delete-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="task-delete-modal-close"
          aria-label="Fermer"
          disabled={loading}
          onClick={onCancel}
        >
          <X size={18} />
        </button>
        <div className="task-delete-modal-icon" aria-hidden>
          <Trash2 size={22} />
        </div>
        <h3 id="task-delete-modal-title">Supprimer la tâche ?</h3>
        <p>
          La tâche <strong>{taskName}</strong> sera supprimée définitivement.
          Cette action est irréversible.
        </p>
        <div className="task-delete-modal-actions">
          <button
            type="button"
            className="secondary-btn"
            disabled={loading}
            onClick={onCancel}
          >
            Annuler
          </button>
          <button
            type="button"
            className="task-delete-modal-confirm"
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskDeleteConfirmModal;
