import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ShieldAlert, Loader2, Users, ChevronRight, Lock } from 'lucide-react';
import { permissionService, type Permission } from '../services/permission.service';
import { useAuth } from '../hooks/useAuth';
import BackButton from '../components/BackButton';
import './Permissions.css';

const Permissions: React.FC = () => {
  const { user } = useAuth();
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [rolePermissions, setRolePermissions] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedRoleId) {
      fetchRolePermissions(selectedRoleId);
    }
  }, [selectedRoleId]);

  const fetchInitialData = async () => {
    try {
      const [permsData, rolesData] = await Promise.all([
        permissionService.getAll(),
        user?.id_entreprise ? permissionService.getEnterpriseRoles(user.id_entreprise) : Promise.resolve([])
      ]);
      
      setAllPermissions(permsData);
      setRoles(rolesData);
      
      if (rolesData.length > 0) {
        // Find Admin or first non-SuperAdmin role
        const defaultRole = rolesData.find(r => r.nom !== 'SuperAdmin') || rolesData[0];
        setSelectedRoleId(defaultRole.id_role);
      }
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRolePermissions = async (roleId: number) => {
    setLoadingPerms(true);
    try {
      const assigned = await permissionService.getRolePermissions(roleId);
      setRolePermissions(assigned.map(p => p.id_permission));
    } catch (error) {
      console.error("Failed to fetch role permissions:", error);
    } finally {
      setLoadingPerms(false);
    }
  };

  const togglePermission = async (permissionId: number) => {
    if (!selectedRoleId) return;
    
    const selectedRole = roles.find(r => r.id_role === selectedRoleId);
    if (selectedRole?.nom === 'SuperAdmin') return; // Protective check

    setSaving(permissionId);
    try {
      if (rolePermissions.includes(permissionId)) {
        await permissionService.removeFromRole(selectedRoleId, permissionId);
        setRolePermissions(prev => prev.filter(id => id !== permissionId));
      } else {
        await permissionService.assignToRole(selectedRoleId, permissionId);
        setRolePermissions(prev => [...prev, permissionId]);
      }
    } catch (error) {
      console.error("Failed to toggle permission:", error);
    } finally {
      setSaving(null);
    }
  };

  const selectedRole = roles.find(r => r.id_role === selectedRoleId);
  const isSuperAdminRole = selectedRole?.nom === 'SuperAdmin';

  if (loading) {
    return (
      <div className="loading-state">
        <Loader2 className="animate-spin" size={40} />
        <p>Chargement de la configuration...</p>
      </div>
    );
  }

  return (
    <div className="permissions-page">
      <BackButton />
      <header className="page-header">
        <div>
          <h1>Gestion des rôles et permissions</h1>
        </div>
      </header>

      <div className="permissions-layout">
        <aside className="roles-sidebar premium-card">
          <div className="sidebar-header">
            <Users size={18} />
            <span>Rôles</span>
          </div>
          <div className="roles-list">
            {roles.map(role => (
              <button 
                key={role.id_role}
                className={`role-item ${selectedRoleId === role.id_role ? 'active' : ''}`}
                onClick={() => setSelectedRoleId(role.id_role)}
              >
                <div className="role-info">
                  <span className="role-name">{role.nom}</span>
                  <span className="role-desc">{role.description?.substring(0, 30)}...</span>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </aside>

        <main className="permissions-content">
          <div className="content-header">
            <div className="selected-role-info">
              <h2>Permissions : {selectedRole?.nom}</h2>
              {isSuperAdminRole && (
                <div className="read-only-badge">
                  <Lock size={14} />
                  <span>Lecture seule (Rôle Système)</span>
                </div>
              )}
            </div>
          </div>

          {loadingPerms ? (
            <div className="loading-permissions">
              <Loader2 className="animate-spin" size={24} />
              <span>Chargement des permissions...</span>
            </div>
          ) : (
            <div className="permissions-grid">
              {allPermissions.map((permission) => (
                <motion.div 
                  key={permission.id_permission}
                  layout
                  className={`permission-card ${rolePermissions.includes(permission.id_permission) ? 'active' : ''} ${isSuperAdminRole ? 'disabled' : ''}`}
                >
                  <div className="permission-icon">
                    {rolePermissions.includes(permission.id_permission) ? 
                      <ShieldCheck color="#10b981" /> : 
                      <ShieldAlert color="#94a3b8" />
                    }
                  </div>
                  <div className="permission-info">
                    <h3>{permission.nom.replace(/_/g, ' ')}</h3>
                    <p>{permission.description || "Aucune description fournie."}</p>
                  </div>
                  <div className="permission-toggle">
                    <button 
                      onClick={() => !isSuperAdminRole && togglePermission(permission.id_permission)}
                      className={`toggle-btn ${rolePermissions.includes(permission.id_permission) ? 'active' : ''}`}
                      disabled={saving === permission.id_permission || isSuperAdminRole}
                    >
                      {saving === permission.id_permission ? 
                        <Loader2 className="animate-spin" size={16} /> : 
                        (rolePermissions.includes(permission.id_permission) ? 'Activé' : 'Désactivé')
                      }
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Permissions;
