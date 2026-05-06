import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, LoginCredentials, RegisterData } from '../types/auth.types';
import { authService } from '../services/auth.service';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
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

  useEffect(() => {
    const initAuth = async () => {
      console.log("initAuth started. isAuthenticated:", authService.isAuthenticated());
      if (authService.isAuthenticated()) {
        try {
          const userData = await authService.getMe();
          console.log("getMe success:", userData);
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (error: any) {
          console.error("Failed to fetch user (getMe):", error?.response?.data || error);
          authService.logout();
          setUser(null);
        }
      } else {
        console.log("Not authenticated, clearing user.");
        setUser(null);
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    await authService.login(credentials);
    const userData = await authService.getMe();
    setUser(userData);
    return userData;
  };

  const register = async (data: RegisterData) => {
    await authService.register(data);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    const roleName = typeof user.role === 'object' ? user.role?.nom : user.role;
    const r = roleName?.toString().trim().toUpperCase();
    if (r === 'SUPERADMIN') return true;
    const has = user.permissions?.includes(permission) || false;
    return has;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      register, 
      logout, 
      isAuthenticated: !!user,
      hasPermission
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
