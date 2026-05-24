import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Loader2, Save, ShieldCheck } from 'lucide-react';
import { PROJECT_POSTE_OPTIONS } from '../lib/projectRoleLabels';
import {
  userAccessService,
  type UserAccessSnapshot,
} from '../services/userAccess.service';
import './AdminUserAccessPanel.css';

type AdminUserAccessPanelProps = {
  userId: number;
};

const AdminUserAccessPanel: React.FC<AdminUserAccessPanelProps> = ({ userId }) => {
  const [snapshot, setSnapshot] = useState<UserAccessSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userAccessService.getUserAccess(userId);
      setSnapshot(data);
    } catch (err) {
      console.error(err);
      setError('Impossible de charger la gestion des accès.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleProject = (projectId: number, enabled: boolean) => {
    setSnapshot((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        projects: prev.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                hasAccess: enabled,
                denied: !enabled,
                sprints: p.sprints.map((s) => ({ ...s, granted: enabled ? s.granted : false })),
                lists: p.lists.map((l) => ({ ...l, granted: enabled ? l.granted : false })),
                tasks: p.tasks.map((t) => ({ ...t, granted: enabled ? t.granted : false })),
              }
            : p
        ),
      };
    });
  };

  const setProjectRole = (projectId: number, roleProjet: string) => {
    setSnapshot((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        projects: prev.projects.map((p) =>
          p.id === projectId ? { ...p, roleProjet } : p
        ),
      };
    });
  };

  const toggleNested = (
    projectId: number,
    kind: 'sprints' | 'lists' | 'tasks',
    itemId: number,
    granted: boolean
  ) => {
    setSnapshot((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        projects: prev.projects.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            [kind]: p[kind].map((item) =>
              item.id === itemId ? { ...item, granted } : item
            ),
          };
        }),
      };
    });
  };

  const toggleFeature = (key: string, granted: boolean) => {
    setSnapshot((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        features: prev.features.map((f) =>
          f.key === key ? { ...f, granted, denied: !granted } : f
        ),
      };
    });
  };

  const handleSave = async () => {
    if (!snapshot) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await userAccessService.saveUserAccess(userId, {
        projects: snapshot.projects.map((p) => ({
          projectId: p.id,
          enabled: p.hasAccess,
          roleProjet: p.roleProjet,
          sprints: p.sprints.map((s) => ({ id: s.id, granted: s.granted })),
          lists: p.lists.map((l) => ({ id: l.id, granted: l.granted })),
          tasks: p.tasks.map((t) => ({ id: t.id, granted: t.granted })),
        })),
        features: snapshot.features.map((f) => ({
          key: f.key,
          granted: f.granted,
        })),
      });
      setSuccess('Accès enregistrés.');
      await load();
    } catch (err) {
      console.error(err);
      setError('Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="admin-user-access" aria-label="Gestion des accès">
        <div className="admin-user-access-loading" role="status">
          <Loader2 size={18} className="spin" aria-hidden />
          Chargement des accès…
        </div>
      </section>
    );
  }

  if (error && !snapshot) {
    return (
      <section className="admin-user-access" aria-label="Gestion des accès">
        <p className="admin-user-access-error">{error}</p>
      </section>
    );
  }

  if (!snapshot) return null;

  return (
    <section className="admin-user-access" aria-label="Gestion des accès">
      <div className="admin-user-access-header">
        <div>
          <h2 className="admin-user-access-title">
            <ShieldCheck size={18} aria-hidden />
            Gestion des accès
          </h2>
          <p className="admin-user-access-subtitle">
            Accès par défaut basé sur le rôle ({snapshot.poste || 'Membre'}). Personnalisez
            projets, ressources et fonctionnalités.
          </p>
        </div>
        <button
          type="button"
          className="admin-user-access-save"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? <Loader2 size={16} className="spin" aria-hidden /> : <Save size={16} aria-hidden />}
          Enregistrer
        </button>
      </div>

      {error ? <p className="admin-user-access-error">{error}</p> : null}
      {success ? <p className="admin-user-access-success">{success}</p> : null}

      <div className="admin-user-access-section">
        <h3>Projets</h3>
        <ul className="admin-user-access-list">
          {snapshot.projects.map((project) => {
            const expanded = expandedProjectId === project.id;
            return (
              <li key={project.id} className="admin-user-access-project">
                <div className="admin-user-access-project-row">
                  <label className="admin-user-access-toggle">
                    <input
                      type="checkbox"
                      checked={project.hasAccess}
                      onChange={(e) => toggleProject(project.id, e.target.checked)}
                    />
                    <span>{project.name}</span>
                  </label>
                  <select
                    className="admin-user-access-role"
                    value={project.roleProjet || snapshot.poste || 'Membre'}
                    disabled={!project.hasAccess}
                    onChange={(e) => setProjectRole(project.id, e.target.value)}
                  >
                    {PROJECT_POSTE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={`admin-user-access-expand${expanded ? ' is-open' : ''}`}
                    onClick={() =>
                      setExpandedProjectId(expanded ? null : project.id)
                    }
                    aria-expanded={expanded}
                    disabled={!project.hasAccess}
                  >
                    Détails
                    <ChevronDown size={14} aria-hidden />
                  </button>
                </div>

                {expanded && project.hasAccess ? (
                  <div className="admin-user-access-nested">
                    {project.sprints.length > 0 ? (
                      <NestedGroup
                        title="Sprints"
                        items={project.sprints}
                        onToggle={(id, granted) =>
                          toggleNested(project.id, 'sprints', id, granted)
                        }
                      />
                    ) : null}
                    {project.lists.length > 0 ? (
                      <NestedGroup
                        title="Listes"
                        items={project.lists}
                        onToggle={(id, granted) =>
                          toggleNested(project.id, 'lists', id, granted)
                        }
                      />
                    ) : null}
                    {project.tasks.length > 0 ? (
                      <NestedGroup
                        title="Tâches"
                        items={project.tasks}
                        onToggle={(id, granted) =>
                          toggleNested(project.id, 'tasks', id, granted)
                        }
                      />
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="admin-user-access-section">
        <h3>Fonctionnalités plateforme</h3>
        <ul className="admin-user-access-features">
          {snapshot.features.map((feature) => (
            <li key={feature.key}>
              <label className="admin-user-access-toggle">
                <input
                  type="checkbox"
                  checked={feature.granted}
                  onChange={(e) => toggleFeature(feature.key, e.target.checked)}
                />
                <span>{feature.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

type NestedGroupProps = {
  title: string;
  items: Array<{ id: number; name: string; granted: boolean }>;
  onToggle: (id: number, granted: boolean) => void;
};

function NestedGroup({ title, items, onToggle }: NestedGroupProps) {
  return (
    <div className="admin-user-access-nested-group">
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <label className="admin-user-access-toggle admin-user-access-toggle--compact">
              <input
                type="checkbox"
                checked={item.granted}
                onChange={(e) => onToggle(item.id, e.target.checked)}
              />
              <span>{item.name}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AdminUserAccessPanel;
