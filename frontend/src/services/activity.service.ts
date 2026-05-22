import api from './api';

export type EnterpriseActivityType =
  | 'project'
  | 'task'
  | 'user'
  | 'invitation'
  | 'member'
  | 'alert'
  | 'access'
  | 'info';

export type EnterpriseActivityStatus = 'ACTIVE' | 'PENDING' | 'WARNING';

export type EnterpriseActivityCategory = 'projects' | 'tasks' | 'team' | 'admin';

export type ActivityFeedFilter = 'all' | EnterpriseActivityCategory;

export interface EnterpriseActivityItem {
  id: string;
  type: EnterpriseActivityType;
  category?: EnterpriseActivityCategory;
  user: string;
  action: string;
  title?: string;
  subtitle?: string;
  entityLabel: string;
  entityType: 'project' | 'task' | 'user' | 'member' | 'invitation' | null;
  entityId: number | null;
  date: string;
  status: EnterpriseActivityStatus;
}

export const activityService = {
  /** Member dashboard — assigned tasks & project workspace events. */
  async getMemberFeed(limit = 12): Promise<EnterpriseActivityItem[]> {
    try {
      const response = await api.get<EnterpriseActivityItem[]>('/activities/member', {
        params: { limit },
      });
      return response.data ?? [];
    } catch (err: unknown) {
      const res = (err as { response?: { status?: number; data?: Record<string, unknown> } })
        ?.response;
      const status = res?.status;
      const data = res?.data;
      const message =
        (typeof data?.message === 'string' && data.message) ||
        (typeof data?.error === 'string' && data.error) ||
        undefined;
      if (status === 401) {
        throw new Error(message || 'Session expirée — reconnectez-vous');
      }
      if (status === 404) {
        throw new Error(
          'Service activité indisponible — redémarrez le backend (route /api/activities/member)'
        );
      }
      if (!status) {
        throw new Error('Serveur injoignable — vérifiez que le backend est démarré');
      }
      throw new Error(message || "Impossible de charger l'activité");
    }
  },

  /** Tenant admin dashboard only — requires enterprise admin role. */
  async getEnterpriseFeed(
    limit = 20,
    category?: ActivityFeedFilter
  ): Promise<EnterpriseActivityItem[]> {
    try {
      const response = await api.get<EnterpriseActivityItem[]>('/activities/enterprise', {
        params: {
          limit,
          ...(category && category !== 'all' ? { category } : {}),
        },
      });
      return response.data ?? [];
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
        throw new Error(message || "Accès réservé aux administrateurs");
      }
      if (status === 401) {
        throw new Error(message || "Session expirée — reconnectez-vous");
      }
      if (status === 404) {
        throw new Error(
          "Service activité indisponible — redémarrez le backend (route /api/activities/enterprise)"
        );
      }
      if (!status) {
        throw new Error("Serveur injoignable — vérifiez que le backend est démarré");
      }
      throw new Error(message || "Impossible de charger l'activité");
    }
  },
};
