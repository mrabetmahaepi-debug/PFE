import prisma from "../prisma/prismaClient";
import {
  getCalendarEnv,
  isGoogleCalendarConfigured,
  isOutlookCalendarConfigured,
} from "../lib/calendarEnv";
import {
  signCalendarOAuthState,
  type CalendarProvider,
} from "../lib/calendarOAuthState";

export type CalendarIntegrationStatus = {
  provider: CalendarProvider;
  connected: boolean;
  accountEmail: string | null;
  connectedAt: string | null;
};

export type CalendarEventDto = {
  id: string;
  provider: CalendarProvider;
  title: string;
  start: string;
  end: string | null;
  dateLabel: string;
  timeLabel: string;
};

type TokenBundle = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  accountEmail: string | null;
  calendarId: string | null;
};

async function oauthFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, init);
}

function formatEventLabels(startIso: string): {
  dateLabel: string;
  timeLabel: string;
} {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) {
    return { dateLabel: "—", timeLabel: "—" };
  }
  const dateLabel = d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeLabel = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { dateLabel, timeLabel };
}

export function getGoogleAuthUrl(userId: number): string {
  const { google } = getCalendarEnv();
  if (!google.clientId || !google.clientSecret) {
    throw new Error("GOOGLE_CALENDAR_NOT_CONFIGURED");
  }
  const state = signCalendarOAuthState(userId, "google");
  const params = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: google.redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function getOutlookAuthUrl(userId: number): string {
  const { microsoft } = getCalendarEnv();
  if (!microsoft.clientId || !microsoft.clientSecret) {
    throw new Error("OUTLOOK_CALENDAR_NOT_CONFIGURED");
  }
  const state = signCalendarOAuthState(userId, "outlook");
  const params = new URLSearchParams({
    client_id: microsoft.clientId,
    redirect_uri: microsoft.redirectUri,
    response_type: "code",
    scope: ["Calendars.Read", "offline_access", "User.Read"].join(" "),
    state,
  });
  return `https://login.microsoftonline.com/${microsoft.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

async function exchangeGoogleCode(code: string): Promise<TokenBundle> {
  const { google } = getCalendarEnv();
  const body = new URLSearchParams({
    code,
    client_id: google.clientId,
    client_secret: google.clientSecret,
    redirect_uri: google.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await oauthFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error || "Google token exchange failed");
  }
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;

  let accountEmail: string | null = null;
  try {
    const profileRes = await oauthFetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${data.access_token}` },
      }
    );
    const profile = (await profileRes.json()) as { email?: string };
    accountEmail = profile.email ?? null;
  } catch {
    accountEmail = null;
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt,
    accountEmail,
    calendarId: "primary",
  };
}

async function exchangeOutlookCode(code: string): Promise<TokenBundle> {
  const { microsoft } = getCalendarEnv();
  const body = new URLSearchParams({
    code,
    client_id: microsoft.clientId,
    client_secret: microsoft.clientSecret,
    redirect_uri: microsoft.redirectUri,
    grant_type: "authorization_code",
  });
  const tokenUrl = `https://login.microsoftonline.com/${microsoft.tenantId}/oauth2/v2.0/token`;
  const res = await oauthFetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Outlook token exchange failed"
    );
  }
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;

  let accountEmail: string | null = null;
  try {
    const meRes = await oauthFetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const me = (await meRes.json()) as {
      mail?: string;
      userPrincipalName?: string;
    };
    accountEmail = me.mail || me.userPrincipalName || null;
  } catch {
    accountEmail = null;
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt,
    accountEmail,
    calendarId: null,
  };
}

export async function saveCalendarIntegration(
  userId: number,
  provider: CalendarProvider,
  tokens: TokenBundle
): Promise<void> {
  await prisma.calendar_integration.upsert({
    where: {
      id_utilisateur_provider: {
        id_utilisateur: userId,
        provider,
      },
    },
    create: {
      id_utilisateur: userId,
      provider,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt,
      account_email: tokens.accountEmail,
      calendar_id: tokens.calendarId,
    },
    update: {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken ?? undefined,
      expires_at: tokens.expiresAt,
      account_email: tokens.accountEmail,
      calendar_id: tokens.calendarId,
    },
  });
}

export async function handleOAuthCallbackWithState(
  provider: CalendarProvider,
  code: string,
  userId: number
): Promise<void> {
  const tokens =
    provider === "google"
      ? await exchangeGoogleCode(code)
      : await exchangeOutlookCode(code);
  await saveCalendarIntegration(userId, provider, tokens);
}

export async function getIntegrationStatuses(
  userId: number
): Promise<CalendarIntegrationStatus[]> {
  const rows = await prisma.calendar_integration.findMany({
    where: { id_utilisateur: userId },
    select: {
      provider: true,
      account_email: true,
      connected_at: true,
    },
  });
  const byProvider = new Map<string, (typeof rows)[number]>(
    rows.map((r) => [r.provider, r])
  );

  return (["google", "outlook"] as CalendarProvider[]).map((provider) => {
    const row = byProvider.get(provider);
    return {
      provider,
      connected: !!row,
      accountEmail: row?.account_email ?? null,
      connectedAt: row?.connected_at?.toISOString() ?? null,
    };
  });
}

export async function disconnectCalendar(
  userId: number,
  provider: CalendarProvider
): Promise<void> {
  await prisma.calendar_integration.deleteMany({
    where: { id_utilisateur: userId, provider },
  });
}

async function getIntegrationRow(userId: number, provider: CalendarProvider) {
  return prisma.calendar_integration.findUnique({
    where: {
      id_utilisateur_provider: {
        id_utilisateur: userId,
        provider,
      },
    },
  });
}

async function refreshGoogleToken(
  userId: number,
  row: { refresh_token: string | null; id: number }
): Promise<string> {
  if (!row.refresh_token) {
    throw new Error("Missing Google refresh token");
  }
  const { google } = getCalendarEnv();
  const body = new URLSearchParams({
    client_id: google.clientId,
    client_secret: google.clientSecret,
    refresh_token: row.refresh_token,
    grant_type: "refresh_token",
  });
  const res = await oauthFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error || "Google refresh failed");
  }
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;
  await prisma.calendar_integration.update({
    where: { id: row.id },
    data: {
      access_token: data.access_token,
      expires_at: expiresAt,
    },
  });
  return data.access_token;
}

async function refreshOutlookToken(
  userId: number,
  row: { refresh_token: string | null; id: number }
): Promise<string> {
  if (!row.refresh_token) {
    throw new Error("Missing Outlook refresh token");
  }
  const { microsoft } = getCalendarEnv();
  const body = new URLSearchParams({
    client_id: microsoft.clientId,
    client_secret: microsoft.clientSecret,
    refresh_token: row.refresh_token,
    grant_type: "refresh_token",
  });
  const tokenUrl = `https://login.microsoftonline.com/${microsoft.tenantId}/oauth2/v2.0/token`;
  const res = await oauthFetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error || "Outlook refresh failed");
  }
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;
  await prisma.calendar_integration.update({
    where: { id: row.id },
    data: {
      access_token: data.access_token,
      expires_at: expiresAt,
    },
  });
  return data.access_token;
}

async function getValidAccessToken(
  userId: number,
  provider: CalendarProvider
): Promise<string | null> {
  const row = await getIntegrationRow(userId, provider);
  if (!row) return null;

  const expiresAt = row.expires_at?.getTime() ?? 0;
  const needsRefresh = expiresAt > 0 && expiresAt < Date.now() + 60_000;

  if (!needsRefresh) return row.access_token;

  try {
    return provider === "google"
      ? await refreshGoogleToken(userId, row)
      : await refreshOutlookToken(userId, row);
  } catch {
    return row.access_token;
  }
}

async function fetchGoogleEvents(
  accessToken: string
): Promise<CalendarEventDto[]> {
  const timeMin = new Date().toISOString();
  const params = new URLSearchParams({
    timeMin,
    maxResults: "25",
    singleEvents: "true",
    orderBy: "startTime",
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`;
  const res = await oauthFetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as {
    items?: Array<{
      id?: string;
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
  };
  if (!res.ok) return [];

  const events: CalendarEventDto[] = [];
  for (const ev of data.items ?? []) {
    const startRaw = ev.start?.dateTime || ev.start?.date;
    if (!startRaw || !ev.id) continue;
    const { dateLabel, timeLabel } = formatEventLabels(startRaw);
    const allDay = !ev.start?.dateTime;
    events.push({
      id: ev.id,
      provider: "google",
      title: ev.summary || "Sans titre",
      start: startRaw,
      end: ev.end?.dateTime || ev.end?.date || null,
      dateLabel,
      timeLabel: allDay ? "Journée" : timeLabel,
    });
  }
  return events;
}

async function fetchOutlookEvents(
  accessToken: string
): Promise<CalendarEventDto[]> {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 30);
  const params = new URLSearchParams({
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    $top: "25",
    $orderby: "start/dateTime",
  });
  const url = `https://graph.microsoft.com/v1.0/me/calendarView?${params}`;
  const res = await oauthFetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="Europe/Paris"',
    },
  });
  const data = (await res.json()) as {
    value?: Array<{
      id?: string;
      subject?: string;
      start?: { dateTime?: string };
      end?: { dateTime?: string };
      isAllDay?: boolean;
    }>;
  };
  if (!res.ok) return [];

  const events: CalendarEventDto[] = [];
  for (const ev of data.value ?? []) {
    const startRaw = ev.start?.dateTime;
    if (!startRaw || !ev.id) continue;
    const { dateLabel, timeLabel } = formatEventLabels(startRaw);
    events.push({
      id: ev.id,
      provider: "outlook",
      title: ev.subject || "Sans titre",
      start: startRaw,
      end: ev.end?.dateTime ?? null,
      dateLabel,
      timeLabel: ev.isAllDay ? "Journée" : timeLabel,
    });
  }
  return events;
}

export async function fetchUpcomingCalendarEvents(
  userId: number
): Promise<CalendarEventDto[]> {
  const events: CalendarEventDto[] = [];

  if (isGoogleCalendarConfigured()) {
    const token = await getValidAccessToken(userId, "google");
    if (token) {
      try {
        events.push(...(await fetchGoogleEvents(token)));
      } catch {
        /* ignore provider errors */
      }
    }
  }

  if (isOutlookCalendarConfigured()) {
    const token = await getValidAccessToken(userId, "outlook");
    if (token) {
      try {
        events.push(...(await fetchOutlookEvents(token)));
      } catch {
        /* ignore provider errors */
      }
    }
  }

  events.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
  return events;
}

export function getCalendarConfigStatus() {
  return {
    google: isGoogleCalendarConfigured(),
    outlook: isOutlookCalendarConfigured(),
  };
}
