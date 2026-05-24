import { Request, Response } from "express";
import { getCalendarEnv } from "../lib/calendarEnv";
import { verifyCalendarOAuthState } from "../lib/calendarOAuthState";
import {
  disconnectCalendar,
  fetchUpcomingCalendarEvents,
  getCalendarConfigStatus,
  getGoogleAuthUrl,
  getIntegrationStatuses,
  getOutlookAuthUrl,
  handleOAuthCallbackWithState,
} from "../services/calendarIntegration.service";

function memberTodayRedirect(
  res: Response,
  params: Record<string, string>
) {
  const { frontendUrl } = getCalendarEnv();
  const qs = new URLSearchParams({ view: "today", ...params });
  res.redirect(`${frontendUrl}/tasks?${qs.toString()}`);
}

export const getCalendarConfigController = async (_req: any, res: Response) => {
  res.json(getCalendarConfigStatus());
};

export const getCalendarIntegrationsController = async (
  req: any,
  res: Response
) => {
  try {
    const statuses = await getIntegrationStatuses(req.user.id);
    res.json({ integrations: statuses, config: getCalendarConfigStatus() });
  } catch (e: any) {
    res.status(500).json({
      message: "Impossible de charger les intégrations calendrier",
      error: e.message,
    });
  }
};

export const getCalendarEventsController = async (req: any, res: Response) => {
  try {
    const events = await fetchUpcomingCalendarEvents(req.user.id);
    res.json({ events });
  } catch (e: any) {
    res.status(500).json({
      message: "Impossible de charger les événements",
      error: e.message,
    });
  }
};

export const googleConnectController = async (req: any, res: Response) => {
  try {
    const url = getGoogleAuthUrl(req.user.id);
    res.json({ url });
  } catch (e: any) {
    const code =
      e.message === "GOOGLE_CALENDAR_NOT_CONFIGURED"
        ? "GOOGLE_CALENDAR_NOT_CONFIGURED"
        : "CALENDAR_CONNECT_ERROR";
    res.status(503).json({
      message:
        "Google Agenda n'est pas configuré sur le serveur (variables d'environnement).",
      code,
    });
  }
};

export const outlookConnectController = async (req: any, res: Response) => {
  try {
    const url = getOutlookAuthUrl(req.user.id);
    res.json({ url });
  } catch (e: any) {
    const code =
      e.message === "OUTLOOK_CALENDAR_NOT_CONFIGURED"
        ? "OUTLOOK_CALENDAR_NOT_CONFIGURED"
        : "CALENDAR_CONNECT_ERROR";
    res.status(503).json({
      message:
        "Microsoft Outlook n'est pas configuré sur le serveur (variables d'environnement).",
      code,
    });
  }
};

export const googleCallbackController = async (req: Request, res: Response) => {
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  const err = String(req.query.error || "");

  if (err) {
    memberTodayRedirect(res, { calendar_error: err });
    return;
  }
  if (!code || !state) {
    memberTodayRedirect(res, { calendar_error: "missing_code" });
    return;
  }

  try {
    const { userId, provider } = verifyCalendarOAuthState(state);
    if (provider !== "google") throw new Error("Invalid provider");
    await handleOAuthCallbackWithState("google", code, userId);
    memberTodayRedirect(res, { calendar_connected: "google" });
  } catch (e: any) {
    console.error("[calendar] Google callback:", e);
    memberTodayRedirect(res, { calendar_error: "google_failed" });
  }
};

export const outlookCallbackController = async (req: Request, res: Response) => {
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  const err = String(req.query.error || "");

  if (err) {
    memberTodayRedirect(res, { calendar_error: err });
    return;
  }
  if (!code || !state) {
    memberTodayRedirect(res, { calendar_error: "missing_code" });
    return;
  }

  try {
    const { userId, provider } = verifyCalendarOAuthState(state);
    if (provider !== "outlook") throw new Error("Invalid provider");
    await handleOAuthCallbackWithState("outlook", code, userId);
    memberTodayRedirect(res, { calendar_connected: "outlook" });
  } catch (e: any) {
    console.error("[calendar] Outlook callback:", e);
    memberTodayRedirect(res, { calendar_error: "outlook_failed" });
  }
};

export const disconnectGoogleController = async (req: any, res: Response) => {
  try {
    await disconnectCalendar(req.user.id, "google");
    res.json({ message: "Google Agenda déconnecté" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
};

export const disconnectOutlookController = async (req: any, res: Response) => {
  try {
    await disconnectCalendar(req.user.id, "outlook");
    res.json({ message: "Microsoft Outlook déconnecté" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
};
