import api from './api';
import type { LoginCredentials, RegisterData, User, AuthResponse } from '../types/auth.types';

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      const rawRole =
        response.data.role ?? (response.data.user as { role?: unknown })?.role;
      const roleStr =
        typeof rawRole === "string"
          ? rawRole
          : rawRole &&
              typeof rawRole === "object" &&
              rawRole !== null &&
              "nom" in rawRole
            ? String((rawRole as { nom?: string }).nom ?? "")
            : "";
      if (roleStr) localStorage.setItem("role", roleStr);
      else localStorage.removeItem("role");
      if (response.data.id_role) {
        localStorage.setItem('id_role', response.data.id_role.toString());
      }
      const ent = (response.data.user as { id_entreprise?: number })?.id_entreprise;
      if (typeof ent === "number") {
        localStorage.setItem("id_entreprise", String(ent));
      } else {
        localStorage.removeItem("id_entreprise");
      }
    }
    return response.data;
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/forgot-password', { email });
    return response.data;
  },

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/reset-password', {
      token,
      password,
    });
    return response.data;
  },

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', data);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    return response.data;
  },

  async getMe(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch {
      /* still clear local session */
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    localStorage.removeItem('id_role');
    localStorage.removeItem("id_entreprise");
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }
};
