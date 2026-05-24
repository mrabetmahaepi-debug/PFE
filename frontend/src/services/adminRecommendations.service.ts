import api from './api';
import type { AdminRecommendation, AdminAppliedRecommendation } from '../lib/adminRecommendations';
import type { AdminApplyContext } from '../lib/adminRecommendationApply';

export type AdminRecommendationsResponse = {
  success: boolean;
  recommendations: AdminRecommendation[];
  appliedRecommendations?: AdminAppliedRecommendation[];
  provider: 'groq' | 'openai' | 'data-driven' | null;
  generatedAt: string;
  configured: boolean;
  message?: string;
};

export type RecordRecommendationStateBody = {
  recommendationId: string;
  status: 'applied' | 'dismissed';
  actionType?: string;
  title?: string;
  resultSummary?: string;
  projectId?: number | null;
  metadata?: Record<string, unknown>;
};

export const adminRecommendationsService = {
  async getRecommendations(): Promise<AdminRecommendationsResponse> {
    const response = await api.get<AdminRecommendationsResponse>(
      '/me/admin/recommendations'
    );
    return response.data;
  },

  async getApplyContext(recommendation: AdminRecommendation): Promise<AdminApplyContext> {
    const response = await api.post<AdminApplyContext>(
      '/me/admin/recommendations/apply-context',
      { recommendation }
    );
    return response.data;
  },

  async recordState(body: RecordRecommendationStateBody): Promise<void> {
    await api.post('/me/admin/recommendations/state', body);
  },
};
