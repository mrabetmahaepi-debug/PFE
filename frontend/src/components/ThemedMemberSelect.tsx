import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, User } from 'lucide-react';
import './ThemedCalendar.css';

export type ThemedMemberOption = {
  value: string;
  label: string;
  role?: string;
  initials: string;
};

type ThemedMemberSelectProps = {
  value: string;
  options: ThemedMemberOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
};

function computeMenuPosition(anchor: HTMLElement, menuWidth: number, menuHeight: number) {
  const rect = anchor.getBoundingClientRect();
  let left = rect.left;
  const maxLeft = window.innerWidth - menuWidth - 12;
  if (left > maxLeft) left = Math.max(12, maxLeft);
  if (left + menuWidth > window.innerWidth - 12) {
    left = Math.max(12, window.innerWidth - menuWidth - 12);
  }
  let top = rect.bottom + 6;
  if (top + menuHeight > window.innerHeight - 12) {
    top = Math.max(12, rect.top - menuHeight - 6);
  }
  return { top, left, width: Math.max(rect.width, menuWidth) };
}

const ThemedMemberSelect: React.FC<ThemedMemberSelectProps> = ({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = '— Sélectionner un membre —',
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value) ?? null;

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setMenuPos(null);
      return;
    }
    const update = () => {
      if (rootRef.current) {
        setMenuPos(computeMenuPosition(rootRef.current, 320, 260));
      }
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      const menu = document.getElementById(listId);
      if (menu?.contains(e.target as Node)) return;
      setOpen(false);
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
  }, [open, listId]);

  const menu =
    open && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <ul
            id={listId}
            className="themed-select-popup"
            role="listbox"
            aria-label={ariaLabel}
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <li key={opt.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`themed-select-option${active ? ' is-active' : ''}`}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <span className="themed-select-option__avatar" aria-hidden>
                      {opt.initials}
                    </span>
                    <span className="themed-select-option__text">
                      <span className="themed-select-option__name">{opt.label}</span>
                      {opt.role ? (
                        <span className="themed-select-option__role">{opt.role}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={`themed-member-select${open ? ' is-open' : ''}`}
    >
      <button
        type="button"
        className="themed-member-select__trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <User className="input-icon" size={16} aria-hidden />
        <span
          className={`themed-member-select__label${!selected ? ' is-placeholder' : ''}`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} className="themed-member-select__chevron" aria-hidden />
      </button>
      {menu}
    </div>
  );
};

export default ThemedMemberSelect;
