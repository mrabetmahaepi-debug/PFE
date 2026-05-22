import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar } from 'lucide-react';
import ActivityThemedCalendar, {
  formatDateDdMmYyyy,
  formatDateInput,
  parseDdMmYyyyToIso,
  parseIsoDateLocal,
} from './ActivityThemedCalendar';
import './ThemedCalendar.css';

type ThemedDateFieldProps = {
  value: string;
  onChange: (iso: string) => void;
  ariaLabel: string;
  required?: boolean;
  /** Allow typing jj/mm/aaaa with auto-format (task due date). */
  allowManualInput?: boolean;
};

function computePopupPosition(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const width = 300;
  let left = rect.left;
  const maxLeft = window.innerWidth - width - 12;
  if (left > maxLeft) left = Math.max(12, maxLeft);
  let top = rect.bottom + 6;
  const estimatedHeight = 360;
  if (top + estimatedHeight > window.innerHeight - 12) {
    top = Math.max(12, rect.top - estimatedHeight - 6);
  }
  return { top, left };
}

const ThemedDateField: React.FC<ThemedDateFieldProps> = ({
  value,
  onChange,
  ariaLabel,
  required = false,
  allowManualInput = false,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null
  );
  const [text, setText] = useState('');

  useEffect(() => {
    if (allowManualInput && isEditingRef.current) return;
    const parsed = parseIsoDateLocal(value);
    setText(parsed ? formatDateDdMmYyyy(parsed) : '');
  }, [value, allowManualInput]);

  const display = allowManualInput
    ? text
    : parseIsoDateLocal(value) != null
      ? formatDateDdMmYyyy(parseIsoDateLocal(value)!)
      : '';

  const commitText = useCallback(
    (next: string) => {
      const formatted = formatDateInput(next);
      setText(formatted);
      const iso = parseDdMmYyyyToIso(formatted);
      if (iso) {
        onChange(iso);
        return;
      }
      if (!formatted.replace(/\D/g, '').length) {
        onChange('');
      }
    },
    [onChange]
  );

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setMenuPos(null);
      return;
    }
    const update = () => {
      if (rootRef.current) setMenuPos(computePopupPosition(rootRef.current));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
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
  }, [open]);

  const handleCalendarPick = (iso: string) => {
    isEditingRef.current = false;
    const parsed = parseIsoDateLocal(iso);
    setText(parsed ? formatDateDdMmYyyy(parsed) : '');
    onChange(iso);
    setOpen(false);
  };

  const popup =
    open && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="themed-date-popup"
            style={{ top: menuPos.top, left: menuPos.left }}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={ariaLabel}
          >
            <ActivityThemedCalendar
              value={value}
              onChange={handleCalendarPick}
              onClear={() => {
                if (!required) {
                  isEditingRef.current = false;
                  setText('');
                  onChange('');
                }
                setOpen(false);
              }}
              clearDisabled={required}
            />
          </div>,
          document.body
        )
      : null;

  const openCalendar = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  };

  return (
    <div
      ref={rootRef}
      className={`themed-date-field${open ? ' is-open' : ''}`}
    >
      <div
        className={`input-wrapper themed-date-field__control${allowManualInput ? ' themed-date-field__control--editable' : ''}`}
        onClick={
          allowManualInput
            ? undefined
            : () => setOpen((v) => !v)
        }
        onKeyDown={
          allowManualInput
            ? undefined
            : (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpen((v) => !v);
                }
              }
        }
        role={allowManualInput ? undefined : 'button'}
        tabIndex={allowManualInput ? undefined : 0}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Calendar className="input-icon" size={16} aria-hidden />
        <input
          ref={inputRef}
          type="text"
          readOnly={!allowManualInput}
          inputMode={allowManualInput ? 'numeric' : undefined}
          value={display}
          placeholder="jj/mm/aaaa"
          maxLength={allowManualInput ? 10 : undefined}
          autoComplete="off"
          spellCheck={false}
          aria-label={ariaLabel}
          required={required}
          onFocus={
            allowManualInput
              ? () => {
                  isEditingRef.current = true;
                }
              : undefined
          }
          onChange={
            allowManualInput
              ? (e) => commitText(e.target.value)
              : undefined
          }
          onPaste={
            allowManualInput
              ? (e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData('text');
                  const input = inputRef.current;
                  if (!input) {
                    commitText(pasted);
                    return;
                  }
                  const start = input.selectionStart ?? text.length;
                  const end = input.selectionEnd ?? text.length;
                  commitText(text.slice(0, start) + pasted + text.slice(end));
                }
              : undefined
          }
          onBlur={
            allowManualInput
              ? () => {
                  isEditingRef.current = false;
                  const digits = text.replace(/\D/g, '');
                  if (!digits.length) {
                    onChange('');
                    setText('');
                    return;
                  }
                  const iso = parseDdMmYyyyToIso(text);
                  if (iso) {
                    const parsed = parseIsoDateLocal(iso);
                    setText(parsed ? formatDateDdMmYyyy(parsed) : '');
                    onChange(iso);
                    return;
                  }
                  const parsed = parseIsoDateLocal(value);
                  setText(parsed ? formatDateDdMmYyyy(parsed) : '');
                }
              : undefined
          }
          onClick={allowManualInput ? (e) => e.stopPropagation() : undefined}
        />
        <button
          type="button"
          className="themed-date-field__open-btn"
          aria-label="Ouvrir le calendrier"
          onMouseDown={(e) => e.preventDefault()}
          onClick={openCalendar}
        >
          <Calendar size={15} aria-hidden />
        </button>
      </div>
      {popup}
    </div>
  );
};

export default ThemedDateField;
