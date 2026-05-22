import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type WorkspaceFilterOption = {
  value: string;
  label: string;
};

interface WorkspaceFilterDropdownProps {
  value: string;
  options: WorkspaceFilterOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}

const WorkspaceFilterDropdown: React.FC<WorkspaceFilterDropdownProps> = ({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected =
    options.find((o) => o.value === value) ?? options[0] ?? { value, label: value };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`ws-filter-dropdown${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
    >
      <button
        type="button"
        className="ws-filter-dropdown-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ws-filter-dropdown-label">{selected.label}</span>
        <ChevronDown size={14} className="ws-filter-dropdown-chevron" aria-hidden />
      </button>
      {open ? (
        <ul id={listId} className="ws-filter-dropdown-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`ws-filter-dropdown-option${active ? ' is-active' : ''}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};

export default WorkspaceFilterDropdown;
