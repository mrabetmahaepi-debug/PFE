import React from 'react';
import DeleteConfirmModal from './DeleteConfirmModal';

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
}) => (
  <DeleteConfirmModal
    open={open}
    itemName={taskName}
    entityKind="task"
    loading={loading}
    onConfirm={onConfirm}
    onCancel={onCancel}
  />
);

export default TaskDeleteConfirmModal;
