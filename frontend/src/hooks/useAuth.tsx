import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, LoginCredentials, RegisterData, AuthResponse } from '../types/auth.types';
import { authService } from '../services/auth.service';
import { meService } from '../services/me.service';
import { checkPermission, isSuperAdmin } from '../lib/permissions';
import { permissionSetHas } from '../lib/permissionCheck';

/** Build session user from POST /auth/login body when GET /auth/me is temporarily unavailable. */
function userFromLoginResponse(res: AuthResponse): User {
  const u = res.user as User & { id?: number };
  const roleStr =
    typeof u.role === 'string'
      ? u.role
      : u.role && typeof u.role === 'object'
        ? String((u.role as { nom?: string }).nom ?? '')
        : typeof res.role === 'string'
          ? res.role
          : '';
  const rawId = u.id ?? u.id_utilisateur;
  const idNum = Number(rawId);
  const packPoste = (res as { poste?: string }).poste ?? (u as { poste?: string }).poste;
  const packProjectRoles =
    (res as { projectRoles?: User['projectRoles'] }).projectRoles ??
    (u as { projectRoles?: User['projectRoles'] }).projectRoles;

  return {
    id: rawId as string | number,
    id_utilisateur: Number.isFinite(idNum) ? idNum : undefined,
    email: u.email,
    name: u.name,
    nom: u.nom,
    prenom: u.prenom,
    role: roleStr || 'Membre',
    id_role: res.id_role ?? u.id_role,
    id_entreprise: u.id_entreprise,
    poste: packPoste,
    projectRoles: packProjectRoles,
    permissions: [],
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  loginWithToken: (token: string) => Promise<User>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  isSuperAdmin: boolean;
  refreshPermissions: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  // Live, deduplicated set of permissions for the current user.
  const [permissionSet, setPermissionSet] = useState<Set<string>>(() => {
    try {
      const cached = localStorage.getItem('user');
      if (cached) {
        const parsed = JSON.parse(cached) as User;
        return new Set(parsed.permissions || []);
      }
    } catch (_) {
      /* noop */
    }
    return new Set();
  });

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    if (!authService.isAuthenticated()) return null;
    try {
      const userData = await authService.getMe();
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      if (userData.permissions) {
        setPermissionSet(new Set(userData.permissions));
      }
      return userData;
    } catch (err) {
      console.warn('Failed to refresh user:', err);
      return null;
    }
  }, []);

  const refreshPermissions = useCallback(async () => {
    if (!authService.isAuthenticated()) return;
    try {
      const data = await meService.getPermissions();
      setPermissionSet(new Set(data.permissions));
      setUser((prev) => {
        if (!prev) return prev;
        const next: User = {
          ...prev,
          permissions: data.permissions,
          id_role: data.id_role ?? prev.id_role,
          id_entreprise: data.id_entreprise ?? prev.id_entreprise,
          role: data.role ?? prev.role,
          isSuperAdmin: data.isSuperAdmin ?? prev.isSuperAdmin,
        };
        localStorage.setItem('user', JSON.stringify(next));
        return next;
      });
    } catch (err) {
      console.warn('Failed to refresh permissions:', err);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      if (authService.isAuthenticated()) {
        try {
          const userData = await authService.getMe();
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
          if (userData.permissions) {
            setPermissionSet(new Set(userData.permissions));
          }
          void refreshPermissions();
        } catch (error: any) {
          console.error('Failed to fetch user (getMe):', error?.response?.data || error);
          authService.logout();
          setUser(null);
          setPermissionSet(new Set());
        }
      } else {
        setUser(null);
        setPermissionSet(new Set());
      }
      setLoading(false);
    };

    initAuth();
  }, [refreshPermissions]);

  const login = async (credentials: LoginCredentials) => {
    const pack = await authService.login(credentials);
    let userData: User;
    try {
      userData = await authService.getMe();
    } catch (e: any) {
      console.warn('getMe after login failed, using login payload:', e?.response?.data || e);
      userData = userFromLoginResponse(pack);
    }
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    if (userData.permissions?.length) {
      setPermissionSet(new Set(userData.permissions));
    }
    void refreshPermissions();
    return userData;
  };

  /**
   * Bootstrap an authenticated session from an externally issued JWT
   * (e.g. the one returned by the invitation acceptance endpoint).
   * Persists the token, fetches the user via /auth/me, then loads RBAC
   * permissions — so the new member lands in the workspace fully ready.
   */
  const loginWithToken = async (token: string): Promise<User> => {
    localStorage.setItem('token', token);
    const userData = await authService.getMe();
    localStorage.setItem('user', JSON.stringify(userData));
    const r = (userData as { role?: unknown }).role;
    const roleStr =
      typeof r === "string"
        ? r
        : r && typeof r === "object" && r !== null && "nom" in (r as object)
          ? String((r as { nom?: string }).nom ?? "")
          : "";
    if (roleStr) localStorage.setItem("role", roleStr);
    else localStorage.removeItem("role");
    if (userData.id_role) {
      localStorage.setItem('id_role', String(userData.id_role));
    }
    setUser(userData);
    if (userData.permissions) {
      setPermissionSet(new Set(userData.permissions));
    }
    await refreshPermissions();
    return userData;
  };

  const register = async (data: RegisterData) => {
    await authService.register(data);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setPermissionSet(new Set());
  };

  const superAdmin = isSuperAdmin(user);

  const hasPermission = useCallback(
    (permission: string): boolean => checkPermission(permission, permissionSet, superAdmin),
    [permissionSet, superAdmin]
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]): boolean => {
      if (superAdmin) return true;
      return permissions.some((p) => permissionSetHas(permissionSet, p));
    },
    [permissionSet, superAdmin]
  );

  const hasAllPermissions = useCallback(
    (permissions: string[]): boolean => {
      if (superAdmin) return true;
      return permissions.every((p) => permissionSetHas(permissionSet, p));
    },
    [permissionSet, superAdmin]
  );

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      loginWithToken,
      register,
      logout,
      isAuthenticated: !!user,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      isSuperAdmin: superAdmin,
      refreshPermissions,
      refreshUser,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
