import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { Tache } from '../types/task';
import { appPaths } from '../lib/workspaceRoutes';
import './MemberPersonalListView.css';

interface MemberPersonalListViewProps {
  tasks: Tache[];
  loading: boolean;
}

const MemberPersonalListView: React.FC<MemberPersonalListViewProps> = ({
  tasks,
  loading,
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => (t.nom_t || '').toLowerCase().includes(q));
  }, [tasks, searchQuery]);

  return (
    <div className="member-personal-page">
      <header className="member-personal-header">
        <h1 className="member-personal-breadcrumb">
          <span className="member-personal-breadcrumb-muted">Mes tâches</span>
          <span className="member-personal-breadcrumb-sep">/</span>
          <span>Liste personnelle</span>
        </h1>
      </header>
      <div className="member-personal-card">
        <div className="member-personal-toolbar">
          <input
            type="search"
            className="member-personal-search"
            placeholder="Rechercher…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {loading ? (
          <p className="member-personal-empty">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="member-personal-empty">Aucune tâche dans votre liste personnelle.</p>
        ) : (
          <ul className="member-personal-list" role="list">
            {filtered.map((t) => (
              <li key={t.id_tache}>
                <button
                  type="button"
                  className="member-personal-item"
                  onClick={() => navigate(appPaths.task(t.id_tache))}
                >
                  {t.nom_t}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="member-personal-add"
          onClick={() => navigate(`${appPaths.projects}?create=task`)}
        >
          <Plus size={14} strokeWidth={2.5} />
          Ajouter une tâche
        </button>
      </div>
    </div>
  );
};

export default MemberPersonalListView;
