import React from 'react';
import {
  Calendar,
  ChartGantt,
  Hash,
  LayoutGrid,
  LayoutList,
  Plus,
  Sheet,
} from 'lucide-react';
import './ClickUpListViewTabs.css';

export type ClickUpViewTabId =
  | 'canal'
  | 'list'
  | 'board'
  | 'calendar'
  | 'gantt'
  | 'tableur';

export interface ClickUpListViewTabsProps {
  activeTab: ClickUpViewTabId;
  onTabChange: (tab: ClickUpViewTabId) => void;
  onAddView?: () => void;
}

const TABS: {
  id: ClickUpViewTabId;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: 'canal', label: 'Canal', icon: <Hash size={15} /> },
  { id: 'list', label: 'Liste', icon: <LayoutList size={15} /> },
  { id: 'board', label: 'Tableau', icon: <LayoutGrid size={15} /> },
  { id: 'calendar', label: 'Calendrier', icon: <Calendar size={15} /> },
  { id: 'gantt', label: 'Gantt', icon: <ChartGantt size={15} /> },
  { id: 'tableur', label: 'Tableur', icon: <Sheet size={15} /> },
];

const ClickUpListViewTabs: React.FC<ClickUpListViewTabsProps> = ({
  activeTab,
  onTabChange,
  onAddView,
}) => {
  return (
    <nav className="cu-view-tabs" aria-label="Vues de la liste">
      <div className="cu-view-tabs-inner">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`cu-view-tab ${activeTab === tab.id ? 'cu-view-tab--active' : ''}`}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTabChange(tab.id);
            }}
          >
            <span className="cu-view-tab-icon" aria-hidden>
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          className="cu-view-tab cu-view-tab--add"
          aria-label="Ajouter une vue"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAddView?.();
          }}
        >
          <Plus size={14} aria-hidden />
          Vue
        </button>
      </div>
    </nav>
  );
};

export default ClickUpListViewTabs;
