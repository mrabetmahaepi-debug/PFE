import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { TaskPriority } from '../types/task';
import { validateTaskDateRange } from '../lib/taskDateValidation';
import {
  MEMBER_LIST_PRIORITY_OPTIONS,
  memberListPriorityLabel,
  taskPriorityToPillTone,
} from '../lib/memberStatusPill';
import ThemedMemberSelect, {
  type ThemedMemberOption,
} from './ThemedMemberSelect';
import './MemberTaskCreateModal.css';

export type ClickUpTaskCreatePayload = {
  title: string;
  startDate: string;
  endDate: string;
  /** Member task create — selected priority (default Moyenne). */
  priority?: TaskPriority;
};

export interface ClickUpTaskNameModalProps {
  open: boolean;
  listLabel?: string;
  loading?: boolean;
  defaultEndDate?: string;
  showAssigneePicker?: boolean;
  assigneeOptions?: ThemedMemberOption[];
  assigneeId?: string;
  onAssigneeChange?: (id: string) => void;
  externalError?: string;
  onClearExternalError?: () => void;
  /** Member « Nouvelle tâche » — placeholder, Priorité field, colored priority. */
  memberMode?: boolean;
  /** @deprecated Use `memberMode` — kept for compatibility. */
  showPriorityPicker?: boolean;
  onSubmit: (payload: ClickUpTaskCreatePayload) => void;
  onCancel: () => void;
}

const todayIso = () => new Date().toISOString().split('T')[0];

const ClickUpTaskNameModal: React.FC<ClickUpTaskNameModalProps> = ({
  open,
  listLabel,
  loading = false,
  defaultEndDate,
  showAssigneePicker = false,
  assigneeOptions = [],
  assigneeId = '',
  onAssigneeChange,
  externalError = '',
  onClearExternalError,
  memberMode = false,
  showPriorityPicker = false,
  onSubmit,
  onCancel,
}) => {
  const isMemberTaskModal = memberMode || showPriorityPicker;
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [localError, setLocalError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const displayError = localError || externalError;

  useEffect(() => {
    if (!open) {
      setTitle('');
      setStartDate(todayIso());
      setEndDate(todayIso());
      setPriority(TaskPriority.MEDIUM);
      setLocalError('');
      return;
    }
    const end =
      defaultEndDate && /^\d{4}-\d{2}-\d{2}$/.test(defaultEndDate)
        ? defaultEndDate
        : todayIso();
    setEndDate(end);
    setStartDate(todayIso());
    setPriority(TaskPriority.MEDIUM);
    setLocalError('');
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, defaultEndDate]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || loading) return;
    const dateErr = validateTaskDateRange(startDate, endDate);
    if (dateErr) {
      setLocalError(dateErr);
      return;
    }
    if (showAssigneePicker && !assigneeId.trim()) {
      setLocalError('Veuillez sélectionner un membre du projet.');
      return;
    }
    setLocalError('');
    onClearExternalError?.();
    onSubmit({
      title: trimmed,
      startDate,
      endDate,
      ...(isMemberTaskModal ? { priority } : {}),
    });
  };

  const priorityTone = taskPriorityToPillTone(priority);
  const namePlaceholder = isMemberTaskModal
    ? 'Saisir nom de tâche'
    : 'Ex. Préparer la revue';

  return (
    <div
      className="cu-member-task-overlay"
      role="presentation"
      onClick={() => !loading && onCancel()}
    >
      <div
        className="cu-member-task-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cu-task-name-title"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="cu-member-task-header">
          <h2 id="cu-task-name-title" className="cu-member-task-title">
            Nouvelle tâche
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

        {listLabel ? (
          <p className="cu-member-task-subtitle">Liste : {listLabel}</p>
        ) : null}

        <form className="cu-member-task-form" onSubmit={handleSubmit}>
          <div className="cu-member-task-field">
            <label className="cu-member-task-label" htmlFor="cu-task-name-input">
              Nom de la tâche
            </label>
            <input
              id="cu-task-name-input"
              ref={inputRef}
              type="text"
              className="cu-member-task-input"
              placeholder={namePlaceholder}
              value={title}
              disabled={loading}
              onChange={(e) => {
                setTitle(e.target.value);
                setLocalError('');
                onClearExternalError?.();
              }}
            />
          </div>

          <div className="cu-member-task-row">
            <div className="cu-member-task-field">
              <label className="cu-member-task-label" htmlFor="cu-task-start">
                Date début
              </label>
              <input
                id="cu-task-start"
                type="date"
                className="cu-member-task-input"
                value={startDate}
                disabled={loading}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setLocalError('');
                  onClearExternalError?.();
                }}
              />
            </div>
            <div className="cu-member-task-field">
              <label className="cu-member-task-label" htmlFor="cu-task-end">
                Date fin
              </label>
              <input
                id="cu-task-end"
                type="date"
                className="cu-member-task-input"
                value={endDate}
                disabled={loading}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setLocalError('');
                  onClearExternalError?.();
                }}
              />
            </div>
          </div>

          {isMemberTaskModal && (
            <div className="cu-member-task-field">
              <label className="cu-member-task-label" htmlFor="cu-task-priority">
                Priorité
              </label>
              <div className="cu-member-task-select-wrap">
                <select
                  id="cu-task-priority"
                  className={`cu-member-task-input cu-member-task-select cu-member-task-select--${priorityTone}`}
                  value={priority}
                  disabled={loading}
                  aria-label={`Priorité : ${memberListPriorityLabel(priority)}`}
                  onChange={(e) => {
                    setPriority(e.target.value as TaskPriority);
                    setLocalError('');
                    onClearExternalError?.();
                  }}
                >
                  {MEMBER_LIST_PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {showAssigneePicker && assigneeOptions.length > 0 && (
            <div className="cu-member-task-assignee">
              <label className="cu-member-task-label">
                Assigné à <span className="cu-member-task-required">*</span>
              </label>
              <ThemedMemberSelect
                value={assigneeId}
                options={assigneeOptions}
                onChange={(v) => {
                  onAssigneeChange?.(v);
                  setLocalError('');
                  onClearExternalError?.();
                }}
                ariaLabel="Membre du projet assigné"
                placeholder="Choisir un membre"
              />
            </div>
          )}

          {displayError ? (
            <p className="cu-member-task-error" role="alert">
              {displayError}
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
              disabled={
                loading ||
                !title.trim() ||
                (showAssigneePicker && !assigneeId.trim())
              }
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
