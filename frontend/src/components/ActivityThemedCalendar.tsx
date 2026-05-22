import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './ThemedCalendar.css';

const WEEKDAYS = ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toIsoDateLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Display format: dd/mm/yyyy */
export function formatDateDdMmYyyy(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Auto-insert slashes while typing (max 8 digits → dd/mm/yyyy). */
export function formatDateInput(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 8);
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  }
  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4)}`;
}

/** Parse dd/mm/yyyy (or digit-only) to ISO yyyy-mm-dd when complete and valid. */
export function parseDdMmYyyyToIso(text: string): string | null {
  const numbers = text.replace(/\D/g, '');
  if (numbers.length !== 8) return null;
  const day = Number(numbers.slice(0, 2));
  const month = Number(numbers.slice(2, 4));
  const year = Number(numbers.slice(4, 8));
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return toIsoDateLocal(d);
}

export function parseIsoDateLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(y, mo, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) return null;
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function capitalizeFrMonth(label: string): string {
  if (!label) return label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

type ActivityThemedCalendarProps = {
  value: string;
  onChange: (iso: string) => void;
  onClear: () => void;
  clearDisabled?: boolean;
};

const ActivityThemedCalendar: React.FC<ActivityThemedCalendarProps> = ({
  value,
  onChange,
  onClear,
  clearDisabled = false,
}) => {
  const selected = parseIsoDateLocal(value);
  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const [viewYear, setViewYear] = useState(
    () => (selected ?? today).getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    () => (selected ?? today).getMonth()
  );

  const monthLabel = capitalizeFrMonth(
    new Date(viewYear, viewMonth, 1).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    })
  );

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startOffset = (first.getDay() + 6) % 7;
    const total = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    const items: Array<{ date: Date | null; key: string }> = [];

    for (let i = 0; i < total; i++) {
      const dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        items.push({ date: null, key: `empty-${i}` });
      } else {
        const date = new Date(viewYear, viewMonth, dayNum);
        items.push({ date, key: toIsoDateLocal(date) });
      }
    }
    return items;
  }, [viewMonth, viewYear]);

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <div className="themed-calendar" role="application" aria-label="Calendrier">
      <div className="themed-calendar__header">
        <button
          type="button"
          className="themed-calendar__nav"
          onClick={goPrev}
          aria-label="Mois précédent"
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <span className="themed-calendar__month">{monthLabel}</span>
        <button
          type="button"
          className="themed-calendar__nav"
          onClick={goNext}
          aria-label="Mois suivant"
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>

      <div className="themed-calendar__weekdays" aria-hidden>
        {WEEKDAYS.map((d) => (
          <span key={d} className="themed-calendar__weekday">
            {d}
          </span>
        ))}
      </div>

      <div className="themed-calendar__grid" role="grid">
        {cells.map(({ date, key }) => {
          if (!date) {
            return (
              <span
                key={key}
                className="themed-calendar__day themed-calendar__day--empty"
                aria-hidden
              />
            );
          }

          const iso = toIsoDateLocal(date);
          const isSelected = selected ? isSameDay(date, selected) : false;
          const isToday = isSameDay(date, today);

          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-label={date.toLocaleDateString('fr-FR')}
              className={`themed-calendar__day${isSelected ? ' is-selected' : ''}${isToday && !isSelected ? ' is-today' : ''}`}
              onClick={() => onChange(iso)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="themed-calendar__footer">
        <button
          type="button"
          className="themed-calendar__footer-btn"
          onClick={() => onChange(toIsoDateLocal(today))}
        >
          Aujourd&apos;hui
        </button>
        <button
          type="button"
          className="themed-calendar__footer-btn themed-calendar__footer-btn--ghost"
          onClick={onClear}
          disabled={clearDisabled}
        >
          Effacer
        </button>
      </div>
    </div>
  );
};

export default ActivityThemedCalendar;
