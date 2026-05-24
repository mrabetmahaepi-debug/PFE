import React from 'react';
import {
  Columns3,
  Filter,
  Plus,
  Search,
  ChevronDown,
  User,
} from 'lucide-react';
import {
  CLICKUP_LIST_COLUMN_DEFS,
  type ListViewColumnKey,
} from '../lib/listViewColumns';
import './ClickUpListViewFilters.css';

export type ClickUpListGroupBy = 'status';

export type AssigneeFilterValue = 'all' | number;

export interface ClickUpListViewFiltersProps {
  groupBy?: ClickUpListGroupBy;
  showSubtasks: boolean;
  onToggleSubtasks: () => void;
  showClosed: boolean;
  onToggleClosed: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  visibleColumns: Record<ListViewColumnKey, boolean>;
  onToggleColumn: (key: ListViewColumnKey) => void;
  columnsOpen: boolean;
  onColumnsOpenChange: (open: boolean) => void;
  filterOpen: boolean;
  onToggleFilter: () => void;
  assigneeFilter: AssigneeFilterValue;
  assigneeOptions: { id: number; label: string }[];
  onAssigneeFilterChange: (value: AssigneeFilterValue) => void;
  assigneeMenuOpen: boolean;
  onAssigneeMenuOpenChange: (open: boolean) => void;
  canCreateTask?: boolean;
  onAddTask?: () => void;
  filterExtras?: React.ReactNode;
}

const ClickUpListViewFilters: React.FC<ClickUpListViewFiltersProps> = ({
  groupBy = 'status',
  showSubtasks,
  onToggleSubtasks,
  showClosed,
  onToggleClosed,
  searchQuery,
  onSearchChange,
  visibleColumns,
  onToggleColumn,
  columnsOpen,
  onColumnsOpenChange,
  filterOpen,
  onToggleFilter,
  assigneeFilter,
  assigneeOptions,
  onAssigneeFilterChange,
  assigneeMenuOpen,
  onAssigneeMenuOpenChange,
  canCreateTask = false,
  onAddTask,
  filterExtras,
}) => {
  const groupLabel = groupBy === 'status' ? 'Statut' : 'Statut';

  const assigneeLabel =
    assigneeFilter === 'all'
      ? 'Assigné'
      : assigneeOptions.find((o) => o.id === assigneeFilter)?.label ??
        'Assigné';

  return (
    <div className="cu-list-view-toolbar">
      <div className="cu-list-view-filters">
        <div className="cu-list-view-filters-left">
          <button
            type="button"
            className="cu-list-view-filter-chip cu-list-view-filter-chip--active"
            aria-pressed="true"
          >
            <span className="cu-list-view-filter-muted">Groupe :</span>
            {groupLabel}
          </button>
          <button
            type="button"
            className={`cu-list-view-filter-chip${showSubtasks ? ' cu-list-view-filter-chip--active' : ''}`}
            aria-pressed={showSubtasks}
            onClick={onToggleSubtasks}
          >
            Sous-tâches
          </button>
          <div className="cu-list-view-filter-popover-wrap">
            <button
              type="button"
              className={`cu-list-view-filter-chip${columnsOpen ? ' cu-list-view-filter-chip--active' : ''}`}
              aria-expanded={columnsOpen}
              onClick={() => onColumnsOpenChange(!columnsOpen)}
            >
              <Columns3 size={13} aria-hidden />
              Colonnes
            </button>
            {columnsOpen && (
              <>
                <div
                  className="cu-list-view-filter-backdrop"
                  role="presentation"
                  onClick={() => onColumnsOpenChange(false)}
                />
                <div className="cu-list-view-columns-menu" role="menu">
                  {CLICKUP_LIST_COLUMN_DEFS.filter((c) => c.key !== 'checkbox').map(
                    (col) => (
                      <label
                        key={col.key}
                        className="cu-list-view-columns-item"
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumns[col.key]}
                          disabled={col.key === 'name'}
                          onChange={() => onToggleColumn(col.key)}
                        />
                        <span>{col.label}</span>
                      </label>
                    )
                  )}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            className={`cu-list-view-filter-chip${filterOpen ? ' cu-list-view-filter-chip--active' : ''}`}
            aria-pressed={filterOpen}
            onClick={onToggleFilter}
          >
            <Filter size={13} aria-hidden />
            Filtrer
          </button>
          <button
            type="button"
            className={`cu-list-view-filter-chip${showClosed ? ' cu-list-view-filter-chip--active' : ''}`}
            aria-pressed={showClosed}
            onClick={onToggleClosed}
          >
            Fermé
          </button>
          <div className="cu-list-view-filter-popover-wrap">
            <button
              type="button"
              className={`cu-list-view-filter-chip${assigneeFilter !== 'all' ? ' cu-list-view-filter-chip--active' : ''}`}
              aria-expanded={assigneeMenuOpen}
              onClick={() => onAssigneeMenuOpenChange(!assigneeMenuOpen)}
            >
              <User size={13} aria-hidden />
              {assigneeLabel}
              <ChevronDown size={12} aria-hidden />
            </button>
            {assigneeMenuOpen && (
              <>
                <div
                  className="cu-list-view-filter-backdrop"
                  role="presentation"
                  onClick={() => onAssigneeMenuOpenChange(false)}
                />
                <div className="cu-list-view-assignee-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className={
                      assigneeFilter === 'all'
                        ? 'cu-list-view-menu-item is-active'
                        : 'cu-list-view-menu-item'
                    }
                    onClick={() => {
                      onAssigneeFilterChange('all');
                      onAssigneeMenuOpenChange(false);
                    }}
                  >
                    Tous les assignés
                  </button>
                  {assigneeOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="menuitem"
                      className={
                        assigneeFilter === opt.id
                          ? 'cu-list-view-menu-item is-active'
                          : 'cu-list-view-menu-item'
                      }
                      onClick={() => {
                        onAssigneeFilterChange(opt.id);
                        onAssigneeMenuOpenChange(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="cu-list-view-filters-right">
          <label className="cu-list-view-search">
            <Search size={14} aria-hidden />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher…"
              aria-label="Rechercher des tâches"
            />
          </label>
          {canCreateTask && onAddTask && (
            <button
              type="button"
              className="cu-list-toolbar-add-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddTask();
              }}
            >
              <Plus size={14} strokeWidth={2.5} />
              Ajouter Tâche
            </button>
          )}
        </div>
      </div>
      {filterOpen && filterExtras ? (
        <div className="cu-list-view-filter-panel">{filterExtras}</div>
      ) : null}
    </div>
  );
};

export default ClickUpListViewFilters;
