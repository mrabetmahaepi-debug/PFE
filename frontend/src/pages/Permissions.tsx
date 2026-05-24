import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, AlertTriangle, Plus, ShieldCheck } from 'lucide-react';
import {
  permissionService,
  type ProjectRoleMatrixResponse,
} from '../services/permission.service';
import { useAuth } from '../hooks/useAuth';
import { usePermission } from '../hooks/usePermission';
import BackButton from '../components/BackButton';
import { dispatchProjectPermissionsChanged } from '../lib/workspaceEvents';
import './Permissions.css';

/** Default editable permission profiles shown in the matrix. */
const DEFAULT_VISIBLE_PROFILES = ['CHEF_PROJET', 'DEVELOPPEUR'] as const;

/** Global / implicit roles — never shown in the editable matrix. */
const IMPLICIT_ROLE_KEYS = new Set([
  'ADMIN',
  'Admin',
  'admin',
  'SUPERADMIN',
  'SuperAdmin',
]);

function visibleRolesStorageKey(enterpriseId: number): string {
  return `gp-perm-visible-roles-${enterpriseId}`;
}

function loadVisibleRoleKeys(enterpriseId: number, roleOrder: string[]): string[] {
  const allowed = new Set(roleOrder.filter((rk) => !IMPLICIT_ROLE_KEYS.has(rk)));
  const defaults = DEFAULT_VISIBLE_PROFILES.filter((rk) => allowed.has(rk));

  try {
    const raw = localStorage.getItem(visibleRolesStorageKey(enterpriseId));
    if (!raw) return defaults.length ? [...defaults] : [...allowed].slice(0, 2);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaults;
    const cleaned = parsed
      .map((rk) => (rk === 'CHEF' ? 'CHEF_PROJET' : rk))
      .filter(
        (rk): rk is string => typeof rk === 'string' && allowed.has(rk)
      );
    return cleaned.length ? cleaned : defaults;
  } catch {
    return defaults;
  }
}

function persistVisibleRoleKeys(enterpriseId: number, keys: string[]): void {
  try {
    localStorage.setItem(visibleRolesStorageKey(enterpriseId), JSON.stringify(keys));
  } catch {
    /* ignore quota / private mode */
  }
}

const Permissions: React.FC = () => {
  const { user } = useAuth();
  const { isSuperAdmin, can } = usePermission();
  const addRoleRef = useRef<HTMLDivElement>(null);

  const canManage = useMemo(
    () => isSuperAdmin || can('TEAM_MANAGE_ROLES') || can('TEAM_MANAGE'),
    [isSuperAdmin, can]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projPayload, setProjPayload] = useState<ProjectRoleMatrixResponse | null>(null);
  const [projLoadFailed, setProjLoadFailed] = useState(false);
  const [savingProj, setSavingProj] = useState(false);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [visibleRoleKeys, setVisibleRoleKeys] = useState<string[]>([
    ...DEFAULT_VISIBLE_PROFILES,
  ]);
  const [addRoleOpen, setAddRoleOpen] = useState(false);

  useEffect(() => {
    void fetchAll();
  }, [user?.id_entreprise, canManage]);

  useEffect(() => {
    if (!addRoleOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (addRoleRef.current && !addRoleRef.current.contains(e.target as Node)) {
        setAddRoleOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [addRoleOpen]);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      if (user?.id_entreprise && canManage) {
        try {
          const pr = await permissionService.getProjectRoleMatrix();
          setProjPayload(pr);
          setProjLoadFailed(false);
          const editableOrder = pr.roleOrder.filter((rk) => !IMPLICIT_ROLE_KEYS.has(rk));
          setVisibleRoleKeys(
            loadVisibleRoleKeys(user.id_entreprise, editableOrder)
          );
        } catch (e) {
          console.error('Failed to load project-role matrix:', e);
          setProjPayload(null);
          setProjLoadFailed(true);
        }
      } else {
        setProjPayload(null);
        setProjLoadFailed(false);
      }
    } catch (err) {
      console.error('Failed to load permissions matrix:', err);
      setError('Impossible de charger la configuration des permissions.');
    } finally {
      setLoading(false);
    }
  };

  const editableRoleOrder = useMemo(() => {
    if (!projPayload) return [];
    return projPayload.roleOrder.filter((rk) => !IMPLICIT_ROLE_KEYS.has(rk));
  }, [projPayload]);

  const displayedRoleKeys = useMemo(() => {
    const allowed = new Set(editableRoleOrder);
    return visibleRoleKeys.filter((rk) => allowed.has(rk));
  }, [editableRoleOrder, visibleRoleKeys]);

  const addableRoleKeys = useMemo(() => {
    const visible = new Set(displayedRoleKeys);
    return editableRoleOrder.filter((rk) => !visible.has(rk));
  }, [editableRoleOrder, displayedRoleKeys]);

  const addProjectRole = (roleKey: string) => {
    if (!user?.id_entreprise) return;
    setVisibleRoleKeys((prev) => {
      if (prev.includes(roleKey)) return prev;
      const next = [...prev, roleKey];
      persistVisibleRoleKeys(user.id_entreprise!, next);
      return next;
    });
    setAddRoleOpen(false);
  };

  const persistMatrix = async (
    matrix: ProjectRoleMatrixResponse['matrix'],
    cellKey?: string
  ): Promise<boolean> => {
    for (const rk of projPayload?.roleOrder ?? []) {
      if (IMPLICIT_ROLE_KEYS.has(rk)) continue;
      if (!matrix[rk]?.length) {
        setError(
          "Chaque rôle de projet doit conserver au moins une permission."
        );
        return false;
      }
    }
    if (cellKey) setSavingCell(cellKey);
    else setSavingProj(true);
    setError(null);
    try {
      const res = await permissionService.saveProjectRoleMatrix(matrix);
      setProjPayload((p) => (p ? { ...p, matrix: res.matrix } : null));
      dispatchProjectPermissionsChanged();
      return true;
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          "Échec de l'enregistrement des permissions projet."
      );
      return false;
    } finally {
      if (cellKey) setSavingCell(null);
      else setSavingProj(false);
    }
  };

  const toggleProjCell = async (roleKey: string, slug: string) => {
    if (!projPayload || savingProj || savingCell) return;
    const curList = projPayload.matrix[roleKey];
    if (!curList) return;
    const cur = new Set(curList);
    const isOn = cur.has(slug);
    if (isOn) cur.delete(slug);
    else cur.add(slug);
    if (cur.size === 0) {
      setError(
        "Chaque rôle de projet doit conserver au moins une permission."
      );
      return;
    }
    const previousMatrix = projPayload.matrix;
    const nextMatrix = {
      ...projPayload.matrix,
      [roleKey]: Array.from(cur),
    };
    setProjPayload((prev) => (prev ? { ...prev, matrix: nextMatrix } : prev));
    const ok = await persistMatrix(nextMatrix, `${roleKey}-${slug}`);
    if (!ok) {
      setProjPayload((prev) =>
        prev ? { ...prev, matrix: previousMatrix } : prev
      );
    }
  };

  const resetProjMatrix = async () => {
    setSavingProj(true);
    setError(null);
    try {
      const res = await permissionService.resetProjectRoleMatrix();
      setProjPayload((p) => (p ? { ...p, matrix: res.matrix } : null));
      dispatchProjectPermissionsChanged();
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          "Échec de la réinitialisation des permissions projet."
      );
    } finally {
      setSavingProj(false);
    }
  };

  if (loading) {
    return (
      <motion.div
        className="permissions-loading"
        role="status"
        aria-live="polite"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Loader2 className="animate-spin" size={32} aria-hidden />
        <p>Chargement de la configuration…</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="permissions-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <BackButton />
      <header className="page-header permissions-page-header">
        <h1>Rôles et permissions</h1>
        <p className="permissions-page-subtitle">
          Configurez les profils de permissions pour les utilisateurs. L&apos;administrateur
          dispose automatiquement de tous les accès — il n&apos;apparaît pas dans ce
          tableau.
        </p>
      </header>

      <div className="permissions-admin-note">
        <ShieldCheck size={16} aria-hidden />
        <span>
          <strong>Admin</strong> — accès complet implicite sur l&apos;ensemble
          des permissions.
        </span>
      </div>

      {error && (
        <motion.div
          className="error-banner premium-card permissions-error-banner"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
        >
          <AlertTriangle size={16} aria-hidden />
          <span>{error}</span>
        </motion.div>
      )}

      {!canManage || !user?.id_entreprise ? (
        <div className="empty-state premium-card">
          <h3>Accès restreint</h3>
          <p>Vous n&apos;avez pas les droits pour gérer les rôles et permissions.</p>
        </div>
      ) : projLoadFailed ? (
        <section className="project-perms-section premium-card">
          <motion.div
            className="project-perms-fallback"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p>Impossible de charger la matrice des permissions projet.</p>
            <button
              type="button"
              className="project-perms-retry"
              onClick={() => void fetchAll()}
            >
              Réessayer
            </button>
          </motion.div>
        </section>
      ) : projPayload ? (
        <section className="project-perms-section premium-card">
          <header className="project-perms-section-head">
            <div className="project-perms-head-text">
              <h2 className="project-perms-title">Profils de permissions</h2>
              <p className="project-perms-lead">
                Chef de projet et Développeur sont configurables par défaut.
                Ajoutez d&apos;autres profils selon vos besoins.
              </p>
            </div>
            <div className="permissions-add-role-wrap" ref={addRoleRef}>
              <button
                type="button"
                className="permissions-add-role-btn"
                aria-expanded={addRoleOpen}
                aria-haspopup="menu"
                disabled={addableRoleKeys.length === 0}
                title={
                  addableRoleKeys.length === 0
                    ? 'Tous les rôles disponibles sont déjà affichés'
                    : undefined
                }
                onClick={() => setAddRoleOpen((o) => !o)}
              >
                <Plus size={15} aria-hidden />
                Ajouter un profil
              </button>
              {addRoleOpen && addableRoleKeys.length > 0 && (
                <div className="permissions-add-role-menu" role="menu">
                  {addableRoleKeys.map((rk) => (
                    <button
                      key={rk}
                      type="button"
                      role="menuitem"
                      className="permissions-add-role-item"
                      onClick={() => addProjectRole(rk)}
                    >
                      {projPayload.roleLabels[rk] ?? rk}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </header>

          <div className="project-perms-toolbar">
            <span className="project-perms-autosave-hint">
              Les modifications sont enregistrées automatiquement.
            </span>
            <button
              type="button"
              className="project-perms-reset"
              disabled={savingProj || !!savingCell}
              onClick={() => void resetProjMatrix()}
            >
              Réinitialiser
            </button>
          </div>

          <div className="matrix-wrapper project-matrix-wrapper">
            <table className="permissions-matrix project-perms-matrix">
              <thead>
                <tr>
                  <th className="cat-col">Permission</th>
                  {displayedRoleKeys.map((rk) => (
                    <th key={rk} className="role-col">
                      <div className="role-col-content">
                        <span className="role-col-name">
                          {projPayload.roleLabels[rk] ?? rk}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projPayload.permissionSlugs.map((slug) => (
                  <tr key={slug} className="perm-row">
                    <td className="perm-name-cell">
                      <motion.div
                        className="perm-name"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.15 }}
                      >
                        {projPayload.permissionLabels[slug] ??
                          slug.replace(/_/g, ' ')}
                      </motion.div>
                    </td>
                    {displayedRoleKeys.map((rk) => {
                      const enabled =
                        projPayload.matrix[rk]?.includes(slug) ?? false;
                      const cellKey = `${rk}-${slug}`;
                      const busy = savingCell === cellKey;
                      return (
                        <td key={rk} className={`cell ${enabled ? 'on' : 'off'}`}>
                          <motion.button
                            type="button"
                            whileTap={
                              savingProj || busy ? undefined : { scale: 0.92 }
                            }
                            className={`toggle-pill ${enabled ? 'on' : 'off'}`}
                            disabled={savingProj || !!savingCell}
                            onClick={() => void toggleProjCell(rk, slug)}
                            aria-pressed={enabled}
                            aria-label={`${enabled ? 'Désactiver' : 'Activer'} ${slug} pour ${projPayload.roleLabels[rk] ?? rk}`}
                          >
                            {busy ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : enabled ? (
                              'Activé'
                            ) : (
                              'Désactivé'
                            )}
                          </motion.button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </motion.div>
  );
};

export default Permissions;
