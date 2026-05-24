import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { taskService } from '../services/task.service';
import { dispatchTaskRenamed } from '../lib/workspaceEvents';
import './EditableSubtaskName.css';

export interface EditableSubtaskNameProps {
  taskId: number;
  value: string;
  disabled?: boolean;
  labelClassName?: string;
  inputClassName?: string;
  /** Single click when not editing (e.g. open task details). */
  onNavigate?: () => void;
  /** Called after a successful save (local UI sync). */
  onRenamed?: (taskId: number, nom_t: string) => void;
}

const EditableSubtaskName: React.FC<EditableSubtaskNameProps> = ({
  taskId,
  value,
  disabled = false,
  labelClassName = '',
  inputClassName = '',
  onNavigate,
  onRenamed,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigateClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(
    () => () => {
      if (navigateClickTimer.current) {
        clearTimeout(navigateClickTimer.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  const cancelEdit = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  const startEdit = useCallback(
    (e: React.SyntheticEvent) => {
      if (disabled || saving) return;
      e.preventDefault();
      e.stopPropagation();
      setDraft(value);
      setEditing(true);
    },
    [disabled, saving, value]
  );

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    if (trimmed === value.trim()) {
      cancelEdit();
      return;
    }
    setSaving(true);
    try {
      await taskService.update(String(taskId), { nom_t: trimmed });
      dispatchTaskRenamed(taskId, trimmed);
      onRenamed?.(taskId, trimmed);
      setEditing(false);
    } catch {
      setDraft(value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [cancelEdit, draft, onRenamed, taskId, value]);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      void save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  if (editing) {
    return (
      <span
        className="editable-subtask-name editable-subtask-name--editing"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          className={`editable-subtask-name-input${inputClassName ? ` ${inputClassName}` : ''}`}
          value={draft}
          disabled={saving}
          aria-label="Renommer la sous-tâche"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onInputKeyDown}
          onBlur={() => void save()}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        />
        {saving ? (
          <Loader2
            size={12}
            className="editable-subtask-name-spinner animate-spin"
            aria-hidden
          />
        ) : null}
      </span>
    );
  }

  const onLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onNavigate || disabled) return;
    if (navigateClickTimer.current) {
      clearTimeout(navigateClickTimer.current);
    }
    navigateClickTimer.current = setTimeout(() => {
      navigateClickTimer.current = null;
      onNavigate();
    }, 220);
  };

  const onLabelDoubleClick = (e: React.MouseEvent) => {
    if (navigateClickTimer.current) {
      clearTimeout(navigateClickTimer.current);
      navigateClickTimer.current = null;
    }
    startEdit(e);
  };

  return (
    <span
      className={`editable-subtask-name${disabled ? ' editable-subtask-name--disabled' : ''}`}
      onClick={onLabelClick}
      onDoubleClick={onLabelDoubleClick}
    >
      <span
        className={`editable-subtask-name-label${labelClassName ? ` ${labelClassName}` : ''}`}
        title={value}
      >
        {value}
      </span>
      {!disabled ? (
        <button
          type="button"
          className="editable-subtask-name-edit"
          aria-label="Renommer la sous-tâche"
          onClick={startEdit}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Pencil size={12} aria-hidden />
        </button>
      ) : null}
    </span>
  );
};

export default EditableSubtaskName;
