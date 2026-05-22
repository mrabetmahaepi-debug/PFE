import React from 'react';
import { LayoutGrid, LayoutList, Plus } from 'lucide-react';
import './ClickUpListToolbar.css';

export type ListViewMode = 'list' | 'board';

export interface ClickUpListToolbarProps {
  listName: string;
  viewMode: ListViewMode;
  onViewModeChange: (mode: ListViewMode) => void;
  canCreateTask: boolean;
  onAddTask: () => void;
}

const ClickUpListToolbar: React.FC<ClickUpListToolbarProps> = ({
  listName,
  viewMode,
  onViewModeChange,
  canCreateTask,
  onAddTask,
}) => {
  return (
    <div className="cu-list-toolbar">
      <div className="cu-list-toolbar-top">
        <h1 className="cu-list-toolbar-title">{listName}</h1>
      </div>
      <div className="cu-list-toolbar-row">
        <div className="cu-list-toolbar-left">
          <button
            type="button"
            className="cu-list-toolbar-chip cu-list-toolbar-chip--active"
            aria-current="false"
          >
            <span className="cu-list-toolbar-chip-muted">Groupe :</span>
            Statut
          </button>
          <button
            type="button"
            className={`cu-list-toolbar-chip cu-list-toolbar-view-btn ${
              viewMode === 'list' ? 'cu-list-toolbar-chip--active' : ''
            }`}
            onClick={() => {
              console.log('Liste clicked');
              onViewModeChange('list');
            }}
            aria-pressed={viewMode === 'list'}
          >
            <LayoutList size={14} aria-hidden />
            Liste
          </button>
          <button
            type="button"
            className={`cu-list-toolbar-chip cu-list-toolbar-view-btn ${
              viewMode === 'board' ? 'cu-list-toolbar-chip--active' : ''
            }`}
            onClick={() => {
              console.log('Tableau clicked');
              onViewModeChange('board');
            }}
            aria-pressed={viewMode === 'board'}
          >
            <LayoutGrid size={14} aria-hidden />
            Tableau
          </button>
        </div>
        <div className="cu-list-toolbar-right">
          {canCreateTask && (
            <button type="button" className="cu-list-toolbar-add-btn" onClick={onAddTask}>
              <Plus size={14} strokeWidth={2.5} />
              Ajouter Tâche
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClickUpListToolbar;
