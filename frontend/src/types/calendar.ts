export type CalendarProvider = 'google' | 'outlook';

export interface CalendarIntegrationStatus {
  provider: CalendarProvider;
  connected: boolean;
  accountEmail: string | null;
  connectedAt: string | null;
}

export interface CalendarEventItem {
  id: string;
  provider: CalendarProvider;
  title: string;
  start: string;
  end: string | null;
  dateLabel: string;
  timeLabel: string;
}

export interface CalendarIntegrationsResponse {
  integrations: CalendarIntegrationStatus[];
  config: {
    google: boolean;
    outlook: boolean;
  };
}
