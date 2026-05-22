import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import './TaskDeleteConfirmModal.css';

export interface ClickUpTaskNameModalProps {
  open: boolean;
  listLabel?: string;
  loading?: boolean;
  onSubmit: (title: string) => void;
  onCancel: () => void;
}

const ClickUpTaskNameModal: React.FC<ClickUpTaskNameModalProps> = ({
  open,
  listLabel,
  loading = false,
  onSubmit,
  onCancel,
}) => {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setTitle('');
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
  };

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
        aria-labelledby="cu-task-name-title"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
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
        <h3 id="cu-task-name-title" className="m-0 mb-1 text-base font-semibold text-[#292d34]">
          Nouvelle tâche
        </h3>
        {listLabel ? (
          <p className="m-0 mb-3 text-xs text-[#87909e]">Liste : {listLabel}</p>
        ) : null}
        <form onSubmit={handleSubmit}>
          <label className="mb-1 block text-xs font-medium text-[#646f79]" htmlFor="cu-task-name-input">
            Nom de la tâche
          </label>
          <input
            id="cu-task-name-input"
            ref={inputRef}
            type="text"
            className="mb-4 w-full rounded-lg border border-[#e6e8ef] px-3 py-2 text-sm text-[#292d34] outline-none focus:border-[#7b68ee] focus:ring-1 focus:ring-[#7b68ee]"
            placeholder="Ex. Préparer la revue"
            value={title}
            disabled={loading}
            onChange={(e) => setTitle(e.target.value)}
          />
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
              type="submit"
              className="task-delete-modal-confirm"
              style={{ background: '#7b68ee' }}
              disabled={loading || !title.trim()}
            >
              {loading ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClickUpTaskNameModal;
