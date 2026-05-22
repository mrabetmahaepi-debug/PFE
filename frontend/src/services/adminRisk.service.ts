import api from './api';

export interface TenantAdminRiskBreakdown {
  delayedProjects: number;
  blockedProjects: number;
  overdueProjectDeadlines: number;
  projectsWithOverdueTasks: number;
  highPriorityOpen: number;
}

export interface TenantAdminRiskSummary {
  totalAtRisk: number;
  weeklyDelta: number;
  subtitle: string;
  breakdown: TenantAdminRiskBreakdown;
}

export const adminRiskService = {
  async getSummary(): Promise<TenantAdminRiskSummary> {
    try {
      const response = await api.get<TenantAdminRiskSummary>('/me/admin/risk-summary');
      return response.data;
    } catch (err: unknown) {
      const res = (err as { response?: { status?: number; data?: Record<string, unknown> } })
        ?.response;
      const status = res?.status;
      const data = res?.data;
      const message =
        (typeof data?.message === 'string' && data.message) ||
        (typeof data?.error === 'string' && data.error) ||
        undefined;
      if (status === 403) {
        throw new Error(message || 'Accès réservé aux administrateurs');
      }
      if (status === 401) {
        throw new Error(message || 'Session expirée — reconnectez-vous');
      }
      if (status === 404) {
        throw new Error(
          'Service risques indisponible — redémarrez le backend (route /api/me/admin/risk-summary)'
        );
      }
      if (!status) {
        throw new Error('Serveur injoignable — vérifiez que le backend est démarré');
      }
      throw new Error(message || 'Impossible de charger les risques');
    }
  },
};
