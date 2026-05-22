import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useLayoutEffect,
} from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  Search,
  Building2,
  Calendar,
  ShieldCheck,
  Clock,
  Activity,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import BackButton from '../components/BackButton';
import ActivityThemedCalendar, {
  formatDateDdMmYyyy,
  formatDateInput,
  parseDdMmYyyyToIso,
  parseIsoDateLocal,
} from '../components/ActivityThemedCalendar';
import {
  getSuperAdminActivityCategory,
  isSuperAdminActivityVisible,
  normalizeSuperAdminAction,
} from '../lib/superAdminActivityFilter';
import './ActivityLogs.css';

function statusClass(status: string): string {
  if (status === 'ACTIVE') return 'activity-logs-status activity-logs-status--active';
  if (status === 'ERROR') return 'activity-logs-status activity-logs-status--error';
  return 'activity-logs-status activity-logs-status--pending';
}

function statusLabel(status: string): string {
  if (status === 'ACTIVE') return 'Completed / Active';
  if (status === 'ERROR') return 'Error';
  return 'Pending';
}

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'All Types' },
  { value: 'admin', label: 'Admin' },
  { value: 'enterprise', label: 'Entreprise' },
] as const;

const FILTER_MENU_GAP = 8;

function useDropdownPosition(
  rootRef: React.RefObject<HTMLDivElement | null>,
  isOpen: boolean,
  menuHeight: number,
  menuWidth = 240
) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const update = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let top = rect.bottom + FILTER_MENU_GAP;
    let left = rect.left;
    if (top + menuHeight > window.innerHeight - FILTER_MENU_GAP) {
      top = Math.max(FILTER_MENU_GAP, rect.top - menuHeight - FILTER_MENU_GAP);
    }
    if (left + menuWidth > window.innerWidth - FILTER_MENU_GAP) {
      left = Math.max(FILTER_MENU_GAP, window.innerWidth - menuWidth - FILTER_MENU_GAP);
    }
    setPos({ top, left });
  }, [menuHeight, menuWidth, rootRef]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPos(null);
      return;
    }
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen, update]);

  return pos;
}

type ActivityFilterDropdownProps = {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  icon?: React.ReactNode;
};

function ActivityFilterDropdown({
  label,
  value,
  options,
  onChange,
  isOpen,
  onOpenChange,
  icon,
}: ActivityFilterDropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuPos = useDropdownPosition(rootRef, isOpen, options.length * 44 + 16);

  useEffect(() => {
    if (!isOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      onOpenChange(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [isOpen, onOpenChange]);

  const menu =
    isOpen && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="activity-logs-dropdown-menu activity-logs-dropdown-menu--portal"
            style={{ top: menuPos.top, left: menuPos.left }}
            role="listbox"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                className={`activity-logs-dropdown-option${opt.value === value ? ' is-selected' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  onOpenChange(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={`activity-logs-field activity-logs-filter${isOpen ? ' is-open' : ''}`}
    >
      {icon}
      <button
        type="button"
        className="activity-logs-filter-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => onOpenChange(!isOpen)}
      >
        <span>{label}</span>
        <ChevronDown size={16} className="chevron" aria-hidden />
      </button>
      {menu}
    </div>
  );
}

type ActivityDateFilterProps = {
  value: string;
  onChange: (value: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

function ActivityDateFilter({ value, onChange, isOpen, onOpenChange }: ActivityDateFilterProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditingRef = useRef(false);
  const menuPos = useDropdownPosition(rootRef, isOpen, 340, 300);
  const [text, setText] = useState('');

  useEffect(() => {
    if (isEditingRef.current) return;
    const parsed = parseIsoDateLocal(value);
    setText(parsed ? formatDateDdMmYyyy(parsed) : '');
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      onOpenChange(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [isOpen, onOpenChange]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    commitText(e.target.value);
  };

  const handleInputPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const input = inputRef.current;
    if (!input) {
      commitText(pasted);
      return;
    }
    const start = input.selectionStart ?? text.length;
    const end = input.selectionEnd ?? text.length;
    const merged = text.slice(0, start) + pasted + text.slice(end);
    commitText(merged);
  };

  const handleInputBlur = () => {
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
  };

  const toggleCalendar = () => onOpenChange(!isOpen);

  const menu =
    isOpen && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="activity-logs-dropdown-menu activity-logs-dropdown-menu--portal themed-date-popup"
            style={{ top: menuPos.top, left: menuPos.left }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <ActivityThemedCalendar
              value={value}
              onChange={(iso) => {
                isEditingRef.current = false;
                const parsed = parseIsoDateLocal(iso);
                setText(parsed ? formatDateDdMmYyyy(parsed) : '');
                onChange(iso);
                onOpenChange(false);
              }}
              onClear={() => {
                isEditingRef.current = false;
                setText('');
                onChange('');
                onOpenChange(false);
              }}
            />
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={`activity-logs-field activity-logs-filter activity-logs-filter--date${isOpen ? ' is-open' : ''}${value ? ' is-filter-active' : ''}`}
    >
      <button
        type="button"
        className="activity-logs-date-icon-btn"
        aria-label="Ouvrir le calendrier"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleCalendar}
      >
        <Calendar size={16} aria-hidden />
      </button>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        className="activity-logs-date-input"
        placeholder="jj/mm/aaaa"
        value={text}
        maxLength={10}
        autoComplete="off"
        spellCheck={false}
        aria-label="Filtrer par date"
        onFocus={() => {
          isEditingRef.current = true;
        }}
        onChange={handleInputChange}
        onPaste={handleInputPaste}
        onBlur={handleInputBlur}
      />
      <button
        type="button"
        className="activity-logs-date-toggle"
        aria-label="Ouvrir le calendrier"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleCalendar}
      >
        <ChevronDown size={16} className="chevron" aria-hidden />
      </button>
      {menu}
    </div>
  );
}

const ActivityLogs: React.FC = () => {
  const navigate = useNavigate();

  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [dateMenuOpen, setDateMenuOpen] = useState(false);

  const typeLabel =
    TYPE_OPTIONS.find((o) => o.value === filterType)?.label ?? 'All Types';

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await api.get('/activities');
        setActivities(res.data || []);
      } catch (err) {
        console.error('Failed to fetch activities', err);
      } finally {
        setLoading(false);
      }
    };
    void fetchActivities();
  }, []);

  const platformActivities = useMemo(
    () => activities.filter(isSuperAdminActivityVisible),
    [activities]
  );

  const filteredActivities = useMemo(() => {
    return platformActivities.filter((act) => {
      const search = searchTerm.toLowerCase().trim();
      const matchSearch =
        !search ||
        String(act.user || '')
          .toLowerCase()
          .includes(search) ||
        String(act.action || '')
          .toLowerCase()
          .includes(search) ||
        String(act.enterprise || '')
          .toLowerCase()
          .includes(search);

      const category = getSuperAdminActivityCategory(act.action);
      const matchType =
        !filterType ||
        filterType === 'ALL' ||
        (filterType === 'admin' && category === 'admin') ||
        (filterType === 'enterprise' && category === 'enterprise');
      
      let matchDate = true;
      const filterDay = parseIsoDateLocal(filterDate);
      if (filterDay && act.date) {
        const actDay = new Date(act.date);
        if (!Number.isNaN(actDay.getTime())) {
          matchDate =
            actDay.getFullYear() === filterDay.getFullYear() &&
            actDay.getMonth() === filterDay.getMonth() &&
            actDay.getDate() === filterDay.getDate();
        }
      }

      return matchSearch && matchType && matchDate;
    });
  }, [platformActivities, searchTerm, filterType, filterDate]);

  const handleRowClick = (type: string, id: number) => {
    switch (type) {
      case 'user':
        navigate('/team');
        break;
      case 'project':
        navigate(`/projects/${id}`);
        break;
      case 'enterprise':
        navigate('/enterprises');
        break;
      case 'task':
        navigate('/tasks');
        break;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="activity-logs-page"
    >
      <header className="activity-logs-header">
        <div className="activity-logs-header__main">
          <div style={{ marginTop: '0.35rem' }}>
            <BackButton fallback="/dashboard" />
          </div>
          <div className="activity-logs-header__text">
            <h1 className="activity-logs-title">Activity History</h1>
          </div>
        </div>
        
          {!loading && (
          <span className="activity-logs-count">
              {filteredActivities.length} result{filteredActivities.length !== 1 ? 's' : ''}
            </span>
          )}
      </header>

      <div className="activity-logs-filters-row">
        <div className="activity-logs-field activity-logs-field--search">
          <Search size={18} aria-hidden />
          <input 
            type="text" 
            placeholder="Search by action, user, or company..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <ActivityDateFilter
            value={filterDate}
          onChange={setFilterDate}
          isOpen={dateMenuOpen}
          onOpenChange={(open) => {
            setDateMenuOpen(open);
            if (open) setTypeMenuOpen(false);
          }}
        />

        <ActivityFilterDropdown
          label={typeLabel}
            value={filterType} 
          options={TYPE_OPTIONS}
          onChange={setFilterType}
          isOpen={typeMenuOpen}
          onOpenChange={(open) => {
            setTypeMenuOpen(open);
            if (open) setDateMenuOpen(false);
          }}
          icon={<Filter size={16} aria-hidden />}
        />
      </div>

      <div className="activity-logs-table-card">
        <table className="activity-logs-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Action</th>
              <th>Company</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="activity-logs-loading">
                  Loading activities...
                </td>
              </tr>
            ) : filteredActivities.length > 0 ? (
              filteredActivities.map((activity) => (
                <tr 
                  key={activity.id} 
                  onClick={() => handleRowClick(activity.type, activity.entityId)}
                >
                  <td>
                    <div className="activity-logs-user">
                      <div className="activity-logs-avatar">
                        {String(activity.user || '?')[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="activity-logs-user-name">
                        {activity.user || 'Unknown User'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="activity-logs-cell-muted">
                      <span>{activity.icon}</span>
                      {normalizeSuperAdminAction(activity.action) ?? activity.action}
                    </div>
                  </td>
                  <td>
                    <div className="activity-logs-cell-muted">
                      <Building2 size={14} aria-hidden />
                      {activity.enterprise}
                    </div>
                  </td>
                  <td>
                    <div className="activity-logs-cell-muted">
                      <Calendar size={14} aria-hidden />
                      {new Date(activity.date).toLocaleDateString('en-GB')}
                    </div>
                  </td>
                  <td>
                    <span className={statusClass(activity.status)}>
                      {activity.status === 'ACTIVE' ? (
                        <ShieldCheck size={12} aria-hidden />
                      ) : activity.status === 'ERROR' ? (
                        <Activity size={12} aria-hidden />
                      ) : (
                        <Clock size={12} aria-hidden />
                      )}
                      {statusLabel(activity.status)}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="activity-logs-empty">
                  <div className="activity-logs-empty-block">
                    <Activity size={40} aria-hidden />
                    <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                      No activities found
                    </p>
                    <p style={{ fontSize: '0.9rem', margin: 0 }}>
                      There are no registered actions on the platform yet.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default ActivityLogs;
