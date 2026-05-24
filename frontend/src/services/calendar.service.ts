import api from './api';
import type {
  CalendarEventItem,
  CalendarIntegrationsResponse,
  CalendarProvider,
} from '../types/calendar';

export async function fetchCalendarIntegrations(): Promise<CalendarIntegrationsResponse> {
  const { data } = await api.get<CalendarIntegrationsResponse>(
    '/calendar/integrations'
  );
  return data;
}

export async function fetchCalendarEvents(): Promise<CalendarEventItem[]> {
  const { data } = await api.get<{ events: CalendarEventItem[] }>(
    '/calendar/events'
  );
  return Array.isArray(data.events) ? data.events : [];
}

export async function startCalendarConnect(
  provider: CalendarProvider
): Promise<string> {
  const path =
    provider === 'google'
      ? '/calendar/google/connect'
      : '/calendar/outlook/connect';
  const { data } = await api.get<{ url: string }>(path);
  if (!data?.url) {
    throw new Error('URL de connexion indisponible');
  }
  return data.url;
}

export async function disconnectCalendar(
  provider: CalendarProvider
): Promise<void> {
  const path =
    provider === 'google' ? '/calendar/google' : '/calendar/outlook';
  await api.delete(path);
}
