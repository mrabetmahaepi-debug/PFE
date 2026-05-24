import React from 'react';
import DeleteConfirmModal, { type DeleteEntityKind } from './DeleteConfirmModal';

export interface HierarchyItemConfirmModalProps {
  open: boolean;
  itemName: string;
  entityKind?: DeleteEntityKind;
  descriptionLine?: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const HierarchyItemConfirmModal: React.FC<HierarchyItemConfirmModalProps> = ({
  open,
  itemName,
  entityKind = 'task',
  descriptionLine,
  confirmLabel = 'Supprimer',
  loading = false,
  onConfirm,
  onCancel,
}) => (
  <DeleteConfirmModal
    open={open}
    itemName={itemName}
    entityKind={entityKind}
    descriptionLine={descriptionLine}
    confirmLabel={confirmLabel}
    loading={loading}
    onConfirm={onConfirm}
    onCancel={onCancel}
  />
);

export default HierarchyItemConfirmModal;
