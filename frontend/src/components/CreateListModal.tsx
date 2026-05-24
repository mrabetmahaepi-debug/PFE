import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import './MemberTaskCreateModal.css';

export type CreateListSprintOption = {
  id_sprint: number;
  nom_s: string;
};

export interface CreateListModalProps {
  open: boolean;
  sprints: CreateListSprintOption[];
  /** Sprint from the row where + was clicked — never default to first sprint in list. */
  initialSprintId?: number | null;
  loading?: boolean;
  error?: string | null;
  onClearError?: () => void;
  onSubmit: (payload: { name: string; sprintId: number }) => void;
  onCancel: () => void;
}

function resolveInitialSprintId(
  sprints: CreateListSprintOption[],
  initialSprintId?: number | null
): string {
  if (initialSprintId == null) return '';
  const match = sprints.some((s) => s.id_sprint === initialSprintId);
  return match ? String(initialSprintId) : '';
}

const CreateListModal: React.FC<CreateListModalProps> = ({
  open,
  sprints,
  initialSprintId = null,
  loading = false,
  error = null,
  onClearError,
  onSubmit,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [sprintId, setSprintId] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const sprintOptions = useMemo(
    () =>
      sprints.map((s) => ({
        id: s.id_sprint,
        label: s.nom_s?.trim() || `Sprint #${s.id_sprint}`,
      })),
    [sprints]
  );

  useEffect(() => {
    if (!open) {
      setName('');
      setSprintId('');
      return;
    }
    setName('');
    setSprintId(resolveInitialSprintId(sprints, initialSprintId));
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, initialSprintId, sprints]);

  if (!open) return null;

  const trimmed = name.trim();
  const sprintNum = Number(sprintId);
  const canSubmit =
    trimmed.length > 0 &&
    Number.isFinite(sprintNum) &&
    sprintNum > 0 &&
    !loading &&
    sprintOptions.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onClearError?.();
    onSubmit({ name: trimmed, sprintId: sprintNum });
  };

  return (
    <div
      className="cu-member-task-overlay cu-create-list-overlay"
      role="presentation"
      onClick={() => !loading && onCancel()}
    >
      <div
        className="cu-member-task-modal cu-create-list-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cu-create-list-title"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="cu-member-task-header">
          <h2 id="cu-create-list-title" className="cu-member-task-title">
            Créer une liste
          </h2>
          <button
            type="button"
            className="cu-member-task-close"
            aria-label="Fermer"
            disabled={loading}
            onClick={onCancel}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <p className="cu-member-task-subtitle cu-create-list-subtitle">
          Toutes les listes se situent dans un sprint. Les listes peuvent contenir
          vos tâches.
        </p>

        <form className="cu-member-task-form" onSubmit={handleSubmit}>
          <div className="cu-member-task-field">
            <label className="cu-member-task-label" htmlFor="cu-create-list-name">
              Nom <span className="cu-member-task-required">*</span>
            </label>
            <input
              id="cu-create-list-name"
              ref={inputRef}
              type="text"
              className="cu-member-task-input"
              placeholder="Ex. Liste de tâches, Sprint backlog, À faire"
              value={name}
              disabled={loading}
              onChange={(e) => {
                setName(e.target.value);
                onClearError?.();
              }}
            />
          </div>

          <div className="cu-member-task-field">
            <label className="cu-member-task-label" htmlFor="cu-create-list-sprint">
              Sprint (emplacement)
            </label>
            {sprintOptions.length === 0 ? (
              <p className="cu-member-task-error" style={{ margin: 0 }}>
                Aucun sprint disponible dans ce projet. Créez un sprint avant une
                liste.
              </p>
            ) : (
              <div className="cu-member-task-select-wrap">
                <select
                  id="cu-create-list-sprint"
                  className="cu-member-task-input cu-member-task-select"
                  value={sprintId}
                  disabled={loading}
                  onChange={(e) => {
                    setSprintId(e.target.value);
                    onClearError?.();
                  }}
                >
                  {!sprintId ? (
                    <option value="">Sélectionner un sprint</option>
                  ) : null}
                  {sprintOptions.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error ? (
            <p className="cu-member-task-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="cu-member-task-actions">
            <button
              type="button"
              className="cu-member-task-btn cu-member-task-btn--cancel"
              disabled={loading}
              onClick={onCancel}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="cu-member-task-btn cu-member-task-btn--submit"
              disabled={!canSubmit}
            >
              {loading ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateListModal;
