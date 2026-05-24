import React, { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { taskService } from '../services/task.service';
import { dispatchTaskDeleted, dispatchTrashRefresh } from '../lib/workspaceEvents';
import { useAuth } from '../hooks/useAuth';
import { isGlobalMember } from '../lib/permissions';
import DeleteConfirmModal from './DeleteConfirmModal';
import './SubtaskDeleteButton.css';

export interface SubtaskDeleteButtonProps {
  taskId: number;
  taskName?: string;
  disabled?: boolean;
  className?: string;
  /** Called after successful delete (local UI sync). */
  onDeleted?: (taskId: number) => void;
}

const SubtaskDeleteButton: React.FC<SubtaskDeleteButtonProps> = ({
  taskId,
  taskName = 'Sous-tâche',
  disabled = false,
  className = '',
  onDeleted,
}) => {
  const { user } = useAuth();
  const memberTrash = isGlobalMember(user);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await taskService.delete(taskId);
      dispatchTaskDeleted(taskId);
      if (memberTrash) dispatchTrashRefresh();
      onDeleted?.(taskId);
      setConfirmOpen(false);
    } catch {
      setError('Impossible de supprimer cette sous-tâche.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`subtask-delete-btn${className ? ` ${className}` : ''}`}
        aria-label="Supprimer la sous-tâche"
        title="Supprimer la sous-tâche"
        disabled={disabled || deleting}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (disabled || deleting) return;
          setConfirmOpen(true);
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {deleting ? (
          <Loader2 size={13} className="subtask-delete-btn-spinner animate-spin" aria-hidden />
        ) : (
          <Trash2 size={13} aria-hidden />
        )}
      </button>

      <DeleteConfirmModal
        open={confirmOpen}
        itemName={taskName}
        entityKind="subtask"
        descriptionLine={
          memberTrash
            ? "La sous-tâche sera déplacée dans la corbeille. Vous pourrez la restaurer plus tard."
            : undefined
        }
        loading={deleting}
        errorMessage={error}
        onCancel={() => {
          if (deleting) return;
          setConfirmOpen(false);
          setError(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
      />
    </>
  );
};

export default SubtaskDeleteButton;
