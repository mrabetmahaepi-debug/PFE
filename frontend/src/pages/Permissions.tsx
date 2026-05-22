import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2,
  Users,
  Lock,
  AlertTriangle,
  Briefcase,
} from 'lucide-react';
import {
  permissionService,
  type Permission,
  type ProjectRoleMatrixResponse,
} from '../services/permission.service';
import {
  meService,
  type PermissionsCatalogResponse,
  type MePermissionGroup,
} from '../services/me.service';
import { useAuth } from '../hooks/useAuth';
import { usePermission } from '../hooks/usePermission';
import BackButton from '../components/BackButton';
import './Permissions.css';

interface RoleWithPermissions {
  id_role: number;
  nom: string;
  description?: string;
  id_entreprise?: number;
  permission?: Array<{ id_permission: number; nom: string }>;
}

const SYSTEM_ROLE_NAMES = new Set(['SuperAdmin']);

/** Hidden on enterprise permissions UI (non-essential / SuperAdmin-only domains). */
const HIDDEN_CATALOG_GROUP_IDS = new Set(['ai', 'billing', 'system']);

const Permissions: React.FC = () => {
  const { user } = useAuth();
  const { isSuperAdmin, can } = usePermission();

  const canManage = useMemo(
    () => isSuperAdmin || can('TEAM_MANAGE_ROLES'),
    [isSuperAdmin, can]
  );

  const [catalog, setCatalog] = useState<PermissionsCatalogResponse | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [rolePerms, setRolePerms] = useState<Record<number, Set<number>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // "roleId-permId"
  const [error, setError] = useState<string | null>(null);
  const [projPayload, setProjPayload] = useState<ProjectRoleMatrixResponse | null>(
    null
  );
  const [projLoadFailed, setProjLoadFailed] = useState(false);
  const [savingProj, setSavingProj] = useState(false);

  useEffect(() => {
    void fetchAll();
  }, [user?.id_entreprise, canManage]);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalogRes, permsRes, rolesRes] = await Promise.all([
        meService.getCatalog(),
        permissionService.getAll(),
        user?.id_entreprise
          ? permissionService.getEnterpriseRoles(user.id_entreprise)
          : Promise.resolve([]),
      ]);

      setCatalog(catalogRes);
      setAllPermissions(permsRes);
      setRoles(rolesRes as RoleWithPermissions[]);

      // Pre-build role -> permissionId set from the included permission list
      const map: Record<number, Set<number>> = {};
      for (const r of rolesRes as RoleWithPermissions[]) {
        map[r.id_role] = new Set((r.permission || []).map((p) => p.id_permission));
      }
      // Roles without inline permission may need a manual fetch
      const missing = (rolesRes as RoleWithPermissions[]).filter(
        (r) => !r.permission
      );
      await Promise.all(
        missing.map(async (r) => {
          try {
            const list = await permissionService.getRolePermissions(r.id_role);
            map[r.id_role] = new Set(list.map((p) => p.id_permission));
          } catch {
            map[r.id_role] = new Set();
          }
        })
      );
      setRolePerms(map);

      if (user?.id_entreprise && canManage) {
        try {
          const pr = await permissionService.getProjectRoleMatrix();
          setProjPayload(pr);
          setProjLoadFailed(false);
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

  // Index permissions by name for quick lookup
  const permsByName = useMemo(() => {
    const m = new Map<string, Permission>();
    for (const p of allPermissions) m.set(p.nom, p);
    return m;
  }, [allPermissions]);

  const groups: MePermissionGroup[] = catalog?.groups || [];

  const visiblePermissionRows = useMemo(() => {
    const rows: Array<MePermissionGroup['permissions'][number]> = [];
    for (const group of groups) {
      if (HIDDEN_CATALOG_GROUP_IDS.has(group.id)) continue;
      for (const perm of group.permissions) {
        rows.push(perm);
      }
    }
    return rows;
  }, [groups]);

  const isRoleEditable = (role: RoleWithPermissions): boolean => {
    if (SYSTEM_ROLE_NAMES.has(role.nom) && !isSuperAdmin) return false;
    return canManage;
  };

  const togglePermission = async (
    roleId: number,
    permName: string
  ) => {
    const role = roles.find((r) => r.id_role === roleId);
    if (!role) return;
    if (!isRoleEditable(role)) return;
    const perm = permsByName.get(permName);
    if (!perm) return;

    const key = `${roleId}-${perm.id_permission}`;
    setSaving(key);

    const current = rolePerms[roleId] || new Set<number>();
    const isOn = current.has(perm.id_permission);

    try {
      if (isOn) {
        await permissionService.removeFromRole(roleId, perm.id_permission);
        const next = new Set(current);
        next.delete(perm.id_permission);
        setRolePerms((prev) => ({ ...prev, [roleId]: next }));
      } else {
        await permissionService.assignToRole(roleId, perm.id_permission);
        const next = new Set(current);
        next.add(perm.id_permission);
        setRolePerms((prev) => ({ ...prev, [roleId]: next }));
      }
    } catch (err: any) {
      console.error('Failed to toggle permission:', err);
      setError(
        err?.response?.data?.message ||
          "Échec de la modification de la permission."
      );
    } finally {
      setSaving(null);
    }
  };

  const toggleProjCell = (roleKey: string, slug: string) => {
    setProjPayload((prev) => {
      if (!prev) return prev;
      const curList = prev.matrix[roleKey];
      if (!curList) return prev;
      const cur = new Set(curList);
      if (cur.has(slug)) cur.delete(slug);
      else cur.add(slug);
      return {
        ...prev,
        matrix: { ...prev.matrix, [roleKey]: Array.from(cur) },
      };
    });
  };

  const saveProjMatrix = async () => {
    if (!projPayload) return;
    for (const rk of projPayload.roleOrder) {
      if (!projPayload.matrix[rk]?.length) {
        setError(
          "Chaque rôle de projet doit conserver au moins une permission avant d'enregistrer."
        );
        return;
      }
    }
    setSavingProj(true);
    setError(null);
    try {
      const res = await permissionService.saveProjectRoleMatrix(projPayload.matrix);
      setProjPayload((p) => (p ? { ...p, matrix: res.matrix } : null));
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          "Échec de l'enregistrement des permissions projet."
      );
    } finally {
      setSavingProj(false);
    }
  };

  const resetProjMatrix = async () => {
    setSavingProj(true);
    setError(null);
    try {
      const res = await permissionService.resetProjectRoleMatrix();
      setProjPayload((p) => (p ? { ...p, matrix: res.matrix } : null));
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
    <div className="permissions-page">
      <BackButton />
      <header className="page-header permissions-page-header">
        <h1>Rôles et permissions</h1>
      </header>

      {error && (
        <div className="error-banner premium-card" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0.75rem 1rem', color: '#b91c1c' }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {roles.length === 0 ? (
        <div className="empty-state premium-card">
          <Users size={32} />
          <h3>Aucun rôle disponible</h3>
          <p>Aucun rôle n'est associé à cette entreprise pour l'instant.</p>
        </div>
      ) : (
        <div className="matrix-wrapper premium-card">
          <table className="permissions-matrix">
            <thead>
              <tr>
                <th className="cat-col">Permission</th>
                {roles.map((r) => {
                  const editable = isRoleEditable(r);
                  return (
                    <th key={r.id_role} className={`role-col ${editable ? '' : 'locked'}`}>
                      <div className="role-col-content">
                        <span className="role-col-name">{r.nom}</span>
                        {!editable && (
                          <span className="role-col-lock" title="Lecture seule">
                            <Lock size={12} />
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visiblePermissionRows.map((perm) => (
                <tr key={perm.name} className="perm-row">
                  <td className="perm-name-cell">
                    <div className="perm-name">{perm.name.replace(/_/g, ' ')}</div>
                  </td>
                      {roles.map((r) => {
                        const dbPerm = permsByName.get(perm.name);
                        const enabled =
                          dbPerm && rolePerms[r.id_role]?.has(dbPerm.id_permission);
                        const editable = isRoleEditable(r) && !!dbPerm;
                        const cellKey = `${r.id_role}-${dbPerm?.id_permission ?? 'na'}`;
                        const busy = saving === cellKey;

                        if (perm.systemOnly && r.nom !== 'SuperAdmin') {
                          return (
                            <td key={r.id_role} className="cell na">
                              <span className="cell-na">—</span>
                            </td>
                          );
                        }

                        return (
                          <td key={r.id_role} className={`cell ${enabled ? 'on' : 'off'}`}>
                            <motion.button
                              type="button"
                              whileTap={editable ? { scale: 0.9 } : undefined}
                              className={`toggle-pill ${enabled ? 'on' : 'off'} ${editable ? '' : 'locked'}`}
                              disabled={!editable || busy}
                              onClick={() => togglePermission(r.id_role, perm.name)}
                              aria-pressed={!!enabled}
                              aria-label={`${enabled ? 'Désactiver' : 'Activer'} ${perm.name} pour ${r.nom}`}
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
      )}

      {user?.id_entreprise && canManage && (
        <section className="project-perms-section premium-card">
          <header className="project-perms-section-head">
            <h2 className="project-perms-title">
              <Briefcase size={22} aria-hidden />
              <span>Permissions dans les projets</span>
            </h2>
          </header>

          {projLoadFailed ? (
            <div className="project-perms-fallback">
              <p>Impossible de charger la matrice des permissions projet.</p>
              <button
                type="button"
                className="project-perms-retry"
                onClick={() => void fetchAll()}
              >
                Réessayer
              </button>
            </div>
          ) : projPayload ? (
            <>
              <div className="project-perms-toolbar">
                <button
                  type="button"
                  className="project-perms-save"
                  disabled={savingProj}
                  onClick={() => void saveProjMatrix()}
                >
                  {savingProj ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                  ) : null}
                  Enregistrer les changements
                </button>
                <button
                  type="button"
                  className="project-perms-reset"
                  disabled={savingProj}
                  onClick={() => void resetProjMatrix()}
                >
                  Réinitialiser aux valeurs par défaut
                </button>
              </div>
              <div className="matrix-wrapper project-matrix-wrapper">
                <table className="permissions-matrix project-perms-matrix">
                  <thead>
                    <tr>
                      <th className="cat-col">Permission (projet)</th>
                      {projPayload.roleOrder.map((rk) => (
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
                          <div className="perm-name">
                            {projPayload.permissionLabels[slug] ?? slug.replace(/_/g, ' ')}
                          </div>
                        </td>
                        {projPayload.roleOrder.map((rk) => {
                          const enabled = projPayload.matrix[rk]?.includes(slug) ?? false;
                          return (
                            <td key={rk} className={`cell ${enabled ? 'on' : 'off'}`}>
                              <motion.button
                                type="button"
                                whileTap={savingProj ? undefined : { scale: 0.9 }}
                                className={`toggle-pill ${enabled ? 'on' : 'off'}`}
                                disabled={savingProj}
                                onClick={() => toggleProjCell(rk, slug)}
                                aria-pressed={enabled}
                                aria-label={`${enabled ? 'Désactiver' : 'Activer'} ${slug} pour ${projPayload.roleLabels[rk] ?? rk}`}
                              >
                                {enabled ? 'Activé' : 'Désactivé'}
                              </motion.button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      )}
    </div>
  );
};

export default Permissions;
