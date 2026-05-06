import api from './api';
import type { LoginCredentials, RegisterData, User, AuthResponse } from '../types/auth.types';

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('role', response.data.role || (response.data.user as any)?.role);
      if (response.data.id_role) {
        localStorage.setItem('id_role', response.data.id_role.toString());
      }
    }
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

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    localStorage.removeItem('id_role');
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }
};
