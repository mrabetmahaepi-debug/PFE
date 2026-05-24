import React from 'react';
import { Trash2 } from 'lucide-react';
import './DeleteConfirmModal.css';

export type DeleteEntityKind =
  | 'subtask'
  | 'task'
  | 'project'
  | 'list'
  | 'sprint'
  | 'space'
  | 'folder';

const ENTITY_PHRASES: Record<DeleteEntityKind, string> = {
  subtask: 'Cette sous-tâche sera supprimée définitivement.',
  task: 'Cette tâche sera supprimée définitivement.',
  project: 'Ce projet sera supprimé définitivement.',
  list: 'Cette liste sera supprimée définitivement.',
  sprint: 'Ce sprint sera supprimé définitivement.',
  space: 'Cet espace sera supprimé définitivement.',
  folder: 'Ce dossier sera supprimé définitivement.',
};

export interface DeleteConfirmModalProps {
  open: boolean;
  itemName: string;
  /** Preset description for known entity types. */
  entityKind?: DeleteEntityKind;
  /** Override the first description line. */
  descriptionLine?: string;
  loading?: boolean;
  confirmLabel?: string;
  /** Override dialog title (default: Supprimer : {name}). */
  title?: string;
  /** Show the “irreversible” footnote (default true). */
  showIrreversibleNote?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  open,
  itemName,
  entityKind = 'task',
  descriptionLine,
  loading = false,
  confirmLabel = 'Supprimer',
  title,
  showIrreversibleNote = true,
  errorMessage = null,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const name = itemName.trim() || 'Élément';
  const dialogTitle = title ?? `Supprimer\u00a0: ${name}`;
  const firstLine = descriptionLine ?? ENTITY_PHRASES[entityKind];

  return (
    <div
      className="cu-delete-modal-overlay"
      role="presentation"
      onClick={() => !loading && onCancel()}
    >
      <div
        className="cu-delete-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cu-delete-modal-title"
        aria-describedby="cu-delete-modal-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cu-delete-modal-icon" aria-hidden>
          <Trash2 size={20} strokeWidth={2} />
        </div>
        <h3 id="cu-delete-modal-title" className="cu-delete-modal-title">
          {dialogTitle}
        </h3>
        <p id="cu-delete-modal-desc" className="cu-delete-modal-desc">
          <span className="cu-delete-modal-desc-line">{firstLine}</span>
          {showIrreversibleNote ? (
            <span className="cu-delete-modal-desc-line">
              Cette action est irréversible.
            </span>
          ) : null}
        </p>
        {errorMessage ? (
          <p className="cu-delete-modal-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className="cu-delete-modal-actions">
          <button
            type="button"
            className="cu-delete-modal-cancel"
            disabled={loading}
            onClick={onCancel}
          >
            Annuler
          </button>
          <button
            type="button"
            className="cu-delete-modal-confirm"
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

export default DeleteConfirmModal;
