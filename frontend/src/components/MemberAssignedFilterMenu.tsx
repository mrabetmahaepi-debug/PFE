import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { KANBAN_WORKFLOW_COLUMNS } from '../lib/kanbanWorkflowColumns';
import {
  EMPTY_MEMBER_ASSIGNED_FILTERS,
  MEMBER_DUE_DATE_FILTER_LABELS,
  MEMBER_PRIORITY_FILTER_LABELS,
  MEMBER_STATUS_ALL_LABEL,
  formatMemberAssignedFilterSummary,
  getMemberStatusFilterLabel,
  hasActiveMemberAssignedFilters,
  type MemberAssignedListFilters,
  type MemberDueDateFilter,
  type MemberPriorityFilter,
} from '../lib/memberAssignedFilters';
import type { KanbanWorkflowColumnId } from '../lib/kanbanWorkflowColumns';
import './MemberAssignedFilterMenu.css';

type SubmenuKey = 'priority' | 'dueDate' | 'status' | null;

const MENU_MIN_WIDTH = 240;
const MENU_GAP = 6;
const VIEWPORT_PAD = 8;

const PRIORITY_OPTIONS: { id: MemberPriorityFilter; label: string }[] = [
  { id: 'high', label: MEMBER_PRIORITY_FILTER_LABELS.high },
  { id: 'medium', label: MEMBER_PRIORITY_FILTER_LABELS.medium },
  { id: 'low', label: MEMBER_PRIORITY_FILTER_LABELS.low },
];

const DUE_DATE_OPTIONS: { id: MemberDueDateFilter; label: string }[] = [
  { id: 'today', label: MEMBER_DUE_DATE_FILTER_LABELS.today },
  { id: 'overdue', label: MEMBER_DUE_DATE_FILTER_LABELS.overdue },
  { id: 'week', label: MEMBER_DUE_DATE_FILTER_LABELS.week },
  { id: 'none', label: MEMBER_DUE_DATE_FILTER_LABELS.none },
];

const STATUS_OPTIONS = KANBAN_WORKFLOW_COLUMNS.map((c) => ({
  id: c.id,
  label: c.label,
}));

type MenuPlacement = 'below' | 'above';

type MenuPosition = {
  top: number;
  left: number;
  placement: MenuPlacement;
};

export interface MemberAssignedFilterMenuProps {
  filters: MemberAssignedListFilters;
  onFiltersChange: (next: MemberAssignedListFilters) => void;
}

const MemberAssignedFilterMenu: React.FC<MemberAssignedFilterMenuProps> = ({
  filters,
  onFiltersChange,
}) => {
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<SubmenuKey>(null);
  const [position, setPosition] = useState<MenuPosition>({
    top: 0,
    left: 0,
    placement: 'below',
  });

  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const active = hasActiveMemberAssignedFilters(filters);
  const summary = formatMemberAssignedFilterSummary(filters);

  const updatePosition = useCallback(() => {
    const btn = buttonRef.current;
    const menu = menuRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight ?? 240;
    const menuWidth = Math.max(menu?.offsetWidth ?? MENU_MIN_WIDTH, MENU_MIN_WIDTH);

    let top = rect.bottom + MENU_GAP;
    let placement: MenuPlacement = 'below';

    if (top + menuHeight > window.innerHeight - VIEWPORT_PAD) {
      const aboveTop = rect.top - MENU_GAP - menuHeight;
      if (aboveTop >= VIEWPORT_PAD) {
        top = aboveTop;
        placement = 'above';
      } else {
        top = Math.max(
          VIEWPORT_PAD,
          Math.min(
            rect.bottom + MENU_GAP,
            window.innerHeight - menuHeight - VIEWPORT_PAD
          )
        );
      }
    }

    let left = rect.right - menuWidth;
    if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;
    if (left + menuWidth > window.innerWidth - VIEWPORT_PAD) {
      left = window.innerWidth - menuWidth - VIEWPORT_PAD;
    }

    setPosition({ top, left, placement });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const id = requestAnimationFrame(() => updatePosition());
    return () => cancelAnimationFrame(id);
  }, [open, submenu, filters, updatePosition]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const ro = new ResizeObserver(() => updatePosition());
    ro.observe(menuRef.current);
    return () => ro.disconnect();
  }, [open, submenu, filters, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
      setSubmenu(null);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSubmenu(null);
      }
    };

    const onReposition = () => updatePosition();

    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);

    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updatePosition]);

  const pickPriority = (id: MemberPriorityFilter) => {
    onFiltersChange({ ...filters, priority: id });
    setSubmenu(null);
  };

  const pickDueDate = (id: MemberDueDateFilter) => {
    onFiltersChange({ ...filters, dueDate: id });
    setSubmenu(null);
  };

  const pickStatus = (id: KanbanWorkflowColumnId) => {
    onFiltersChange({ ...filters, status: id, allStatuses: false });
    setSubmenu(null);
  };

  const pickAllStatuses = () => {
    onFiltersChange({ ...filters, status: null, allStatuses: true });
    setSubmenu(null);
  };

  const reset = () => {
    onFiltersChange({ ...EMPTY_MEMBER_ASSIGNED_FILTERS });
    setSubmenu(null);
  };

  const menuContent = open ? (
    <div
      ref={menuRef}
      className={`member-assigned-filter-menu member-assigned-filter-menu--portal member-assigned-filter-menu--${position.placement}`}
      role="menu"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
        minWidth: MENU_MIN_WIDTH,
      }}
    >
      {submenu === null ? (
        <>
          <button
            type="button"
            className={`member-assigned-filter-row ${filters.priority ? 'has-value' : ''}`}
            role="menuitem"
            onClick={() => setSubmenu('priority')}
          >
            <span className="member-assigned-filter-row-label">
              <span>Priorité</span>
              {filters.priority ? (
                <span className="member-assigned-filter-value">
                  {MEMBER_PRIORITY_FILTER_LABELS[filters.priority]}
                </span>
              ) : null}
            </span>
            <ChevronRight size={14} aria-hidden />
          </button>
          <button
            type="button"
            className={`member-assigned-filter-row ${filters.dueDate ? 'has-value' : ''}`}
            role="menuitem"
            onClick={() => setSubmenu('dueDate')}
          >
            <span className="member-assigned-filter-row-label">
              <span>Date d&apos;échéance</span>
              {filters.dueDate ? (
                <span className="member-assigned-filter-value">
                  {MEMBER_DUE_DATE_FILTER_LABELS[filters.dueDate]}
                </span>
              ) : null}
            </span>
            <ChevronRight size={14} aria-hidden />
          </button>
          <button
            type="button"
            className={`member-assigned-filter-row ${filters.status != null ? 'has-value' : ''}`}
            role="menuitem"
            onClick={() => setSubmenu('status')}
          >
            <span className="member-assigned-filter-row-label">
              <span>Statut</span>
              {filters.status != null ? (
                <span className="member-assigned-filter-value">
                  {getMemberStatusFilterLabel(filters.status)}
                </span>
              ) : null}
            </span>
            <ChevronRight size={14} aria-hidden />
          </button>
          <div className="member-assigned-filter-divider" role="separator" />
          <button
            type="button"
            className="member-assigned-filter-row member-assigned-filter-row--reset"
            role="menuitem"
            disabled={!active}
            onClick={reset}
          >
            Réinitialiser les filtres
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="member-assigned-filter-back"
            onClick={() => setSubmenu(null)}
          >
            <ChevronLeft size={14} aria-hidden />
            {submenu === 'priority'
              ? 'Priorité'
              : submenu === 'dueDate'
                ? 'Date d\'échéance'
                : 'Statut'}
          </button>
          <div className="member-assigned-filter-submenu">
            {submenu === 'priority' &&
              PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`member-assigned-filter-choice ${filters.priority === opt.id ? 'is-selected' : ''}`}
                  role="menuitemradio"
                  aria-checked={filters.priority === opt.id}
                  onClick={() => pickPriority(opt.id)}
                >
                  <span>{opt.label}</span>
                  {filters.priority === opt.id ? (
                    <Check size={14} strokeWidth={2.5} aria-hidden />
                  ) : null}
                </button>
              ))}
            {submenu === 'dueDate' &&
              DUE_DATE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`member-assigned-filter-choice ${filters.dueDate === opt.id ? 'is-selected' : ''}`}
                  role="menuitemradio"
                  aria-checked={filters.dueDate === opt.id}
                  onClick={() => pickDueDate(opt.id)}
                >
                  <span>{opt.label}</span>
                  {filters.dueDate === opt.id ? (
                    <Check size={14} strokeWidth={2.5} aria-hidden />
                  ) : null}
                </button>
              ))}
            {submenu === 'status' && (
              <>
                <button
                  type="button"
                  className={`member-assigned-filter-choice ${filters.allStatuses ? 'is-selected' : ''}`}
                  role="menuitemradio"
                  aria-checked={filters.allStatuses}
                  onClick={pickAllStatuses}
                >
                  <span>{MEMBER_STATUS_ALL_LABEL}</span>
                  {filters.allStatuses ? (
                    <Check size={14} strokeWidth={2.5} aria-hidden />
                  ) : null}
                </button>
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`member-assigned-filter-choice ${!filters.allStatuses && filters.status === opt.id ? 'is-selected' : ''}`}
                    role="menuitemradio"
                    aria-checked={filters.status === opt.id}
                    onClick={() => pickStatus(opt.id)}
                  >
                    <span>{opt.label}</span>
                    {filters.status === opt.id ? (
                      <Check size={14} strokeWidth={2.5} aria-hidden />
                    ) : null}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  ) : null;

  return (
    <div className="member-assigned-filter-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`member-assigned-tool member-assigned-tool--filter ${open || active ? 'member-assigned-tool--active-soft' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        title={summary ?? undefined}
        onClick={() => {
          setOpen((v) => !v);
          if (open) setSubmenu(null);
        }}
      >
        <Filter size={15} strokeWidth={2} aria-hidden />
        <span className="member-assigned-tool-filter-text">
          Filtrer
          {summary ? (
            <span className="member-assigned-filter-summary">: {summary}</span>
          ) : null}
        </span>
        {active ? (
          <span className="member-assigned-filter-dot" aria-hidden />
        ) : null}
      </button>

      {typeof document !== 'undefined' && menuContent
        ? createPortal(menuContent, document.body)
        : null}
    </div>
  );
};

export default MemberAssignedFilterMenu;
