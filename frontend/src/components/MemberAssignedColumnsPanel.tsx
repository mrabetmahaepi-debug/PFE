import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Settings, X } from 'lucide-react';
import {
  MEMBER_ASSIGNED_COLUMN_LABELS,
  MEMBER_ASSIGNED_HIDDEN_KEYS,
  MEMBER_ASSIGNED_VISIBLE_KEYS,
  type MemberAssignedColumnKey,
  type MemberAssignedColumnVisibility,
} from '../lib/memberAssignedColumns';

const ALL_COLUMN_KEYS: MemberAssignedColumnKey[] = [
  ...MEMBER_ASSIGNED_VISIBLE_KEYS,
  ...MEMBER_ASSIGNED_HIDDEN_KEYS,
];
import './MemberAssignedColumnsPanel.css';

export type MemberColumnsPanelTab = 'create' | 'existing';

export interface MemberAssignedColumnsPanelProps {
  open: boolean;
  visibility: MemberAssignedColumnVisibility;
  onVisibilityChange: (next: MemberAssignedColumnVisibility) => void;
  onClose: () => void;
}

function ColumnToggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="member-columns-toggle" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className="member-columns-toggle-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="member-columns-toggle-track" aria-hidden>
        <span className="member-columns-toggle-thumb" />
      </span>
      <span className="member-columns-toggle-label">{label}</span>
    </label>
  );
}

const MemberAssignedColumnsPanel: React.FC<MemberAssignedColumnsPanelProps> = ({
  open,
  visibility,
  onVisibilityChange,
  onClose,
}) => {
  const [tab, setTab] = useState<MemberColumnsPanelTab>('existing');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) {
      setSearch('');
      setTab('existing');
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filterKeys = (keys: MemberAssignedColumnKey[]) => {
    const q = search.trim().toLowerCase();
    if (!q) return keys;
    return keys.filter((k) =>
      MEMBER_ASSIGNED_COLUMN_LABELS[k].toLowerCase().includes(q)
    );
  };

  const displayedKeys = useMemo(
    () => filterKeys(ALL_COLUMN_KEYS.filter((k) => visibility[k])),
    [search, visibility]
  );
  const maskedKeys = useMemo(
    () => filterKeys(ALL_COLUMN_KEYS.filter((k) => !visibility[k])),
    [search, visibility]
  );

  const setColumn = (key: MemberAssignedColumnKey, on: boolean) => {
    onVisibilityChange({ ...visibility, [key]: on });
  };

  const hideAllVisible = () => {
    const next = { ...visibility };
    for (const k of MEMBER_ASSIGNED_VISIBLE_KEYS) {
      next[k] = false;
    }
    onVisibilityChange(next);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className={`member-columns-backdrop ${open ? 'is-visible' : ''}`}
        role="presentation"
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`member-columns-panel ${open ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-columns-panel-title"
        aria-hidden={!open}
      >
        <header className="member-columns-panel-header">
          <div className="member-columns-panel-title-row">
            <button
              type="button"
              className="member-columns-panel-settings"
              aria-label="Paramètres des champs"
            >
              <Settings size={16} strokeWidth={2} />
            </button>
            <h2 id="member-columns-panel-title" className="member-columns-panel-title">
              Champs
            </h2>
          </div>
          <button
            type="button"
            className="member-columns-panel-close"
            aria-label="Fermer"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <div className="member-columns-panel-search">
          <Search size={14} className="member-columns-panel-search-icon" aria-hidden />
          <input
            type="search"
            placeholder="Rechercher des champs nouveaux ou existants"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="member-columns-panel-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'create'}
            className={`member-columns-tab ${tab === 'create' ? 'is-active' : ''}`}
            onClick={() => setTab('create')}
          >
            Créer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'existing'}
            className={`member-columns-tab ${tab === 'existing' ? 'is-active' : ''}`}
            onClick={() => setTab('existing')}
          >
            Ajouter existant
          </button>
        </div>

        <div className="member-columns-panel-body">
          {tab === 'create' ? (
            <p className="member-columns-panel-hint">
              Créez un champ personnalisé pour cette liste (bientôt disponible).
            </p>
          ) : (
            <>
              <div className="member-columns-section">
                <div className="member-columns-section-head">
                  <span className="member-columns-section-title">Affiché</span>
                  <button
                    type="button"
                    className="member-columns-section-action"
                    onClick={hideAllVisible}
                  >
                    Tout masquer
                  </button>
                </div>
                <div className="member-columns-toggle-list">
                  {displayedKeys.map((key) => (
                    <ColumnToggle
                      key={key}
                      id={`col-visible-${key}`}
                      label={MEMBER_ASSIGNED_COLUMN_LABELS[key]}
                      checked
                      onChange={(on) => setColumn(key, on)}
                    />
                  ))}
                  {displayedKeys.length === 0 && (
                    <p className="member-columns-empty">Aucun champ trouvé</p>
                  )}
                </div>
              </div>

              <div className="member-columns-section">
                <div className="member-columns-section-head">
                  <span className="member-columns-section-title">Masqué</span>
                </div>
                <div className="member-columns-toggle-list">
                  {maskedKeys.map((key) => (
                    <ColumnToggle
                      key={key}
                      id={`col-hidden-${key}`}
                      label={MEMBER_ASSIGNED_COLUMN_LABELS[key]}
                      checked={false}
                      onChange={(on) => setColumn(key, on)}
                    />
                  ))}
                  {maskedKeys.length === 0 && (
                    <p className="member-columns-empty">Aucun champ trouvé</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </>,
    document.body
  );
};

export default MemberAssignedColumnsPanel;
