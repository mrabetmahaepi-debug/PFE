import api from './api';

export const alertService = {
  async triggerCheck(): Promise<{ message: string; alertsCreated: number }> {
    const response = await api.post('/alerts/check');
    return response.data;
  }
};
