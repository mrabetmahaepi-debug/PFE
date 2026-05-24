import { trimEnvValue, env } from "../config/env";

function apiBaseUrl(): string {
  const port = trimEnvValue(env.port) || "5000";
  return trimEnvValue(process.env.API_PUBLIC_URL) || `http://127.0.0.1:${port}`;
}

export function getCalendarEnv() {
  const frontendUrl =
    trimEnvValue(env.frontendUrl) || "http://localhost:5173";
  const apiBase = apiBaseUrl();

  return {
    frontendUrl: frontendUrl.replace(/\/+$/, ""),
    google: {
      clientId: trimEnvValue(process.env.GOOGLE_CALENDAR_CLIENT_ID),
      clientSecret: trimEnvValue(process.env.GOOGLE_CALENDAR_CLIENT_SECRET),
      redirectUri:
        trimEnvValue(process.env.GOOGLE_CALENDAR_REDIRECT_URI) ||
        `${apiBase}/api/calendar/google/callback`,
    },
    microsoft: {
      clientId: trimEnvValue(process.env.MICROSOFT_CALENDAR_CLIENT_ID),
      clientSecret: trimEnvValue(process.env.MICROSOFT_CALENDAR_CLIENT_SECRET),
      tenantId: trimEnvValue(process.env.MICROSOFT_CALENDAR_TENANT_ID) || "common",
      redirectUri:
        trimEnvValue(process.env.MICROSOFT_CALENDAR_REDIRECT_URI) ||
        `${apiBase}/api/calendar/outlook/callback`,
    },
  };
}

export function isGoogleCalendarConfigured(): boolean {
  const { google } = getCalendarEnv();
  return !!(google.clientId && google.clientSecret);
}

export function isOutlookCalendarConfigured(): boolean {
  const { microsoft } = getCalendarEnv();
  return !!(microsoft.clientId && microsoft.clientSecret);
}
