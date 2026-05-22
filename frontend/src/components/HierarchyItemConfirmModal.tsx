import React from 'react';
import { Trash2, X } from 'lucide-react';
import './TaskDeleteConfirmModal.css';

export interface HierarchyItemConfirmModalProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const HierarchyItemConfirmModal: React.FC<HierarchyItemConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Supprimer',
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
        aria-labelledby="hierarchy-confirm-title"
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
        <h3 id="hierarchy-confirm-title">{title}</h3>
        <p>{message}</p>
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
            {loading ? 'Suppression…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HierarchyItemConfirmModal;
