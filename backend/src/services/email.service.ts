/**
 * Email service
 * -------------
 * Transactional email layer used by the invitation flow (and any future
 * notifications). It prefers providers in this order:
 *
 *   1. Brevo HTTP API (recommended)   — uses BREVO_API_KEY + EMAIL_FROM.
 *   2. SMTP (Nodemailer)              — uses SMTP_HOST/USER/PASS.
 *   3. "log" transport (development)  — never delivers, prints to stdout.
 *
 * Feature controllers like createTeamInvitations call `isEmailConfigured()`
 * and refuse to operate when neither Brevo nor SMTP is configured — there
 * is no "copy invitation link" workaround in the production UX.
 *
 * Env vars:
 *   BREVO_API_KEY       Brevo (Sendinblue) API key — recommended provider.
 *   EMAIL_FROM          "GestionPro <no-reply@yourdomain.com>" or a plain
 *                       email; this is the From header used for all
 *                       transactional emails.
 *   EMAIL_REPLY_TO      Optional reply-to address.
 *   APP_NAME            Brand name shown in the from header when
 *                       EMAIL_FROM only contains an email address.
 *
 *   SMTP_HOST/USER/PASS Optional SMTP fallback (Gmail, SES, Mailgun, ...).
 *   SMTP_PORT, SMTP_SECURE, SMTP_FROM, SMTP_REPLY_TO
 */
import nodemailer, { Transporter } from "nodemailer";
import { getEmailTransportEnv } from "../config/env";

const APP_NAME = process.env.APP_NAME || "GestionPro";

const truthy = (v: string | undefined) =>
  /^(1|true|yes|on)$/i.test(String(v || "").trim());

const env = (key: string) => String(process.env[key] || "").trim();

/** Basic email sanity check reused for outbound identity + SMTP user. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Brevo expects a verified sender. Treat the stack as configured only if
 * the admin set EMAIL_FROM / SMTP_FROM or a recognizable SMTP_USER address.
 */
function hasOutboundSenderConfigured(): boolean {
  const parseLooseFrom = (raw: string): boolean => {
    const v = raw.trim();
    if (!v) return false;
    const m = v.match(/^\s*"?([^"<]+?)"?\s*<\s*([^>\s]+)\s*>\s*$/);
    if (m && EMAIL_RE.test(m[2])) return true;
    return EMAIL_RE.test(v);
  };
  const emailFrom = getEmailTransportEnv().emailFrom;
  return (
    parseLooseFrom(emailFrom) ||
    parseLooseFrom(env("SMTP_FROM")) ||
    EMAIL_RE.test(env("SMTP_USER"))
  );
}

export type EmailProvider = "brevo" | "smtp" | "log";

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

interface BrevoConfig {
  apiKey: string;
  configured: boolean;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  allowNoAuth: boolean;
  configured: boolean;
  missing: string[];
}

function getBrevoConfig(): BrevoConfig {
  const apiKey = getEmailTransportEnv().brevoApiKey;
  return {
    apiKey,
    configured: !!(apiKey && hasOutboundSenderConfigured()),
  };
}

function getSmtpConfig(): SmtpConfig {
  const host = env("SMTP_HOST");
  const port = Number(env("SMTP_PORT") || 587);
  const secure = truthy(env("SMTP_SECURE"));
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");
  const allowNoAuth = truthy(env("SMTP_ALLOW_NO_AUTH"));
  const configured = !!host && (allowNoAuth || (!!user && !!pass));
  const missing: string[] = [];
  if (!host) missing.push("SMTP_HOST");
  if (!allowNoAuth && !user) missing.push("SMTP_USER");
  if (!allowNoAuth && !pass) missing.push("SMTP_PASS");
  return { host, port, secure, user, pass, allowNoAuth, configured, missing };
}

/**
 * Resolves the email provider that will actually be used.
 * Brevo > SMTP > log.
 */
export function getEmailProvider(): EmailProvider {
  if (getBrevoConfig().configured) return "brevo";
  if (getSmtpConfig().configured) return "smtp";
  return "log";
}

export function isEmailConfigured(): boolean {
  return getEmailProvider() !== "log";
}

/**
 * Startup / diagnostics — no secrets. Mirrors `process.env` via the same trims
 * as the rest of this module (`env()` helper).
 */
export function getSafeEmailBootstrapDiagnostics() {
  const { brevoApiKey, emailFrom } = getEmailTransportEnv();
  return {
    emailProviderConfigured: isEmailConfigured(),
    hasBrevoApiKey: brevoApiKey.length > 0,
    hasEmailFrom: emailFrom.length > 0,
    outboundSenderReady: hasOutboundSenderConfigured(),
    hasFrontendUrl: !!(
      (process.env.FRONTEND_URL || "").trim() ||
      (process.env.APP_URL || "").trim()
    ),
  };
}

/** Safe transport snapshot for invitation / startup logs (no secrets). */
export function getEmailTransportLogContext() {
  const smtp = getSmtpConfig();
  const from = resolveFromAddress();
  const { brevoApiKey, emailFrom, emailReplyTo } = getEmailTransportEnv();
  return {
    provider: getEmailProvider(),
    from: from.raw,
    fromEmail: from.email,
    replyTo: emailReplyTo || env("SMTP_REPLY_TO") || null,
    brevoApiKeyPresent: brevoApiKey.length > 0,
    brevoApiKeyPreview:
      brevoApiKey.length > 13
        ? `${brevoApiKey.slice(0, 10)}…${brevoApiKey.slice(-3)}`
        : brevoApiKey.length > 0
          ? "<present>"
          : "<empty>",
    emailFromEnv: emailFrom || null,
    smtpHost: smtp.host || null,
    smtpPort: smtp.configured ? smtp.port : null,
    smtpSecure: smtp.configured ? smtp.secure : null,
    smtpUser: smtp.user || null,
    smtpPassPresent: smtp.pass.length > 0,
    smtpAllowNoAuth: smtp.allowNoAuth,
    outboundSenderReady: hasOutboundSenderConfigured(),
  };
}

export function logEmailProviderDiagnostics(prefix = "[email:config]"): void {
  console.info(prefix, getEmailTransportLogContext());
}

export function getEmailProviderInfo() {
  const key = getEmailTransportEnv().brevoApiKey;
  const apiKeyPresent = key.length > 0;
  const brevo = getBrevoConfig();
  const smtp = getSmtpConfig();
  const brevo_api_key_masked =
    key.length > 14
      ? `${key.slice(0, 8)}…${key.slice(-4)}`
      : key.length > 0
        ? "***"
        : null;
  return {
    provider: getEmailProvider(),
    brevo_configured: brevo.configured,
    brevo_api_key_masked,
    outbound_sender_ready: hasOutboundSenderConfigured(),
    brevo_missing_sender: !!(apiKeyPresent && !hasOutboundSenderConfigured()),
    smtp_configured: smtp.configured,
    smtp_missing: smtp.missing,
    resolved_sender_email: resolveFromAddress().email,
  };
}

// ---------------------------------------------------------------------------
// "From" header parsing
// ---------------------------------------------------------------------------

interface FromAddress {
  email: string;
  name: string;
  raw: string;
}

/**
 * Accepts:
 *   "Name <email@host.com>"
 *   "email@host.com"
 *   ""                       → uses APP_NAME + SMTP_USER fallback.
 */
function parseFromHeader(raw: string): FromAddress | null {
  const value = raw.trim();
  if (!value) return null;
  const match = value.match(/^\s*"?([^"<]+?)"?\s*<\s*([^>\s]+)\s*>\s*$/);
  if (match) {
    const [, name, email] = match;
    if (!EMAIL_RE.test(email)) return null;
    return { email, name: name.trim() || APP_NAME, raw: value };
  }
  if (EMAIL_RE.test(value)) {
    return { email: value, name: APP_NAME, raw: `"${APP_NAME}" <${value}>` };
  }
  return null;
}

function resolveFromAddress(): FromAddress {
  const explicit =
    parseFromHeader(getEmailTransportEnv().emailFrom) ||
    parseFromHeader(env("SMTP_FROM"));
  if (explicit) return explicit;
  const smtpUser = env("SMTP_USER");
  if (EMAIL_RE.test(smtpUser)) {
    return { email: smtpUser, name: APP_NAME, raw: `"${APP_NAME}" <${smtpUser}>` };
  }
  const fallbackDomain = env("APP_DOMAIN") || "gestionpro.local";
  const email = `no-reply@${fallbackDomain.replace(/^https?:\/\//, "")}`;
  return { email, name: APP_NAME, raw: `"${APP_NAME}" <${email}>` };
}

function resolveReplyTo(override?: string): string | undefined {
  const reply = getEmailTransportEnv().emailReplyTo;
  return (
    override ||
    (reply || undefined) ||
    env("SMTP_REPLY_TO") ||
    undefined
  );
}

// ---------------------------------------------------------------------------
// SMTP / log transport
// ---------------------------------------------------------------------------

let cachedSmtpTransporter: Transporter | null = null;
let cachedLogTransporter: Transporter | null = null;

function buildSmtpTransporter(smtp: SmtpConfig): Transporter {
  if (cachedSmtpTransporter) return cachedSmtpTransporter;
  cachedSmtpTransporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth:
      smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
    requireTLS: !smtp.secure,
    connectionTimeout: 20_000,
    socketTimeout: 25_000,
  });
  return cachedSmtpTransporter;
}

function buildLogTransporter(): Transporter {
  if (cachedLogTransporter) return cachedLogTransporter;
  cachedLogTransporter = nodemailer.createTransport({
    streamTransport: true,
    newline: "unix",
    buffer: true,
  });
  return cachedLogTransporter;
}

// ---------------------------------------------------------------------------
// Brevo HTTP API transport
// ---------------------------------------------------------------------------

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

function brevoApiTimeoutMs(): number {
  const n = Number.parseInt(env("BREVO_API_TIMEOUT_MS"), 10);
  if (Number.isFinite(n) && n >= 3000 && n <= 120000) return n;
  return 25000;
}

/** Normalize Brevo error payloads into a single string */
function extractBrevoErrorMessage(payload: any, fallback: string): string {
  const m = payload?.message;
  if (typeof m === "string" && m.trim()) return m.trim();
  if (Array.isArray(m) && m.length)
    return m.map((x) => String(x)).join("; ").trim();
  if (payload?.error && typeof payload.error === "object") {
    const e = payload.error as Record<string, string>;
    const parts = ["message", "description", "code"]
      .map((k) => e[k])
      .filter(Boolean);
    if (parts.length) return parts.join(" — ");
  }
  if (typeof payload?.error === "string") return payload.error;
  return fallback;
}

/** Avoid dumping huge payloads in logs */
function sanitizeBrevoLogPayload(p: unknown): unknown {
  if (!p || typeof p !== "object") return p;
  const o = { ...(p as Record<string, unknown>) };
  if (typeof o.raw === "string" && (o.raw as string).length > 500)
    o.raw = `${(o.raw as string).slice(0, 497)}…`;
  return o;
}

async function sendViaBrevo(
  apiKey: string,
  from: FromAddress,
  params: SendEmailParams,
  replyTo: string | undefined
): Promise<SendEmailResult> {
  const body: Record<string, unknown> = {
    sender: { email: from.email, name: from.name },
    to: [{ email: params.to }],
    subject: params.subject,
    htmlContent: params.html,
    textContent: params.text || stripHtml(params.html),
  };
  if (replyTo) {
    body.replyTo = { email: replyTo };
  }

  const timeoutMs = brevoApiTimeoutMs();
  const startedAt = Date.now();
  const provider = "brevo" as const;

  console.log({
    provider,
    from: from.raw,
    to: params.to,
    subject: params.subject,
  });

  console.info("[email:brevo] invoking API", {
    endpoint: BREVO_ENDPOINT,
    timeoutMs,
    apiKeyPreview:
      apiKey.length > 13
        ? `${apiKey.slice(0, 10)}…${apiKey.slice(-3)}`
        : apiKey
          ? "<key present>"
          : "<empty>",
  });

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const elapsedMs = Date.now() - startedAt;
    const text = await response.text();
    let payload: any = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }
    }

    if (!response.ok) {
      const brevoBody = payload ?? (text || null);
      const msg = extractBrevoErrorMessage(
        payload,
        `Brevo HTTP ${response.status}`
      );
      console.error("[email:brevo] delivery failed", {
        status: response.status,
        ms: elapsedMs,
        to: params.to,
        error: msg,
        brevoResponse: sanitizeBrevoLogPayload(brevoBody),
      });
      return {
        delivered: false,
        mode: "brevo",
        error: msg,
        httpStatus: response.status,
        brevoResponse: brevoBody,
      };
    }

    console.info("[email:brevo] accepted by Brevo", {
      to: params.to,
      ms: elapsedMs,
      messageId: payload?.messageId,
      httpStatus: response.status,
      brevoResponse: sanitizeBrevoLogPayload(payload),
    });

    return {
      delivered: true,
      mode: "brevo",
      messageId: payload?.messageId,
      httpStatus: response.status,
      brevoResponse: payload,
    };
  } catch (err: unknown) {
    const error = err as {
      message?: string;
      status?: number;
      statusCode?: number;
      code?: string;
      name?: string;
      response?: {
        body?: unknown;
        data?: unknown;
        text?: string;
        status?: number;
      };
    };
    const elapsedMs = Date.now() - startedAt;
    console.error("BREVO SEND ERROR:", {
      message: error?.message,
      status: error?.status ?? error?.statusCode ?? error?.response?.status,
      body: error?.response?.body,
      data: error?.response?.data,
      text: error?.response?.text,
      name: error?.name,
      code: error?.code,
      ms: elapsedMs,
    });
    const isAbort =
      error?.name === "AbortError" ||
      error?.name === "TimeoutError" ||
      error?.code === "UND_ERR_HEADERS_TIMEOUT";
    const msg = isAbort
      ? `Délai Brevo dépassé (${timeoutMs} ms)`
      : error?.message || "Erreur réseau lors de l'appel à Brevo";
    return {
      delivered: false,
      mode: "brevo",
      error: msg,
      brevoResponse: {
        message: error?.message,
        status: error?.status ?? error?.statusCode,
        body: error?.response?.body,
        data: error?.response?.data,
        text: error?.response?.text,
        name: error?.name,
        code: error?.code,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  delivered: boolean;
  mode: EmailProvider;
  messageId?: string;
  error?: string;
  /** HTTP status from Brevo (when applicable). */
  httpStatus?: number;
  /** Raw Brevo JSON/text body — success or error payload. */
  brevoResponse?: unknown;
}

/**
 * Sends a transactional email through whichever provider is configured.
 * Never throws — returns a structured `SendEmailResult` so callers can
 * decide whether to surface a failure to the user or continue silently.
 */
export async function sendEmail(
  params: SendEmailParams
): Promise<SendEmailResult> {
  const provider = getEmailProvider();
  const from = resolveFromAddress();
  const replyTo = resolveReplyTo(params.replyTo);

  console.log({
    provider,
    from: from.raw,
    to: params.to,
    subject: params.subject,
  });

  if (provider === "brevo") {
    const { apiKey } = getBrevoConfig();
    return sendViaBrevo(apiKey, from, params, replyTo);
  }

  if (provider === "smtp") {
    const smtp = getSmtpConfig();
    const transporter = buildSmtpTransporter(smtp);
    console.info("[email:smtp] sendMail starting", {
      to: params.to,
      subject: params.subject,
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      user: smtp.user || "(none)",
      from: from.raw,
      replyTo: replyTo ?? null,
    });
    try {
      const info = await transporter.sendMail({
        from: from.raw,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text || stripHtml(params.html),
        replyTo,
      });
      console.info("[email:smtp] sendMail success", {
        to: params.to,
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
      });
      return {
        delivered: true,
        mode: "smtp",
        messageId: info.messageId,
      };
    } catch (err: unknown) {
      const e = err as {
        message?: string;
        code?: string;
        response?: string;
        responseCode?: number;
        command?: string;
        errno?: number;
        syscall?: string;
      };
      console.error("[email:smtp] sendMail failed", {
        to: params.to,
        host: smtp.host,
        port: smtp.port,
        user: smtp.user || "(none)",
        from: from.raw,
        message: e?.message ?? String(err),
        code: e?.code,
        responseCode: e?.responseCode,
        response: e?.response,
        command: e?.command,
        errno: e?.errno,
        syscall: e?.syscall,
        stack: err instanceof Error ? err.stack : undefined,
      });
      return {
        delivered: false,
        mode: "smtp",
        error: e?.message || "SMTP error",
      };
    }
  }

  // No provider configured — write the rendered email to stdout so
  // developers can still preview the body during early setup.
  try {
    const transporter = buildLogTransporter();
    const info = await transporter.sendMail({
      from: from.raw,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text || stripHtml(params.html),
      replyTo,
    });
    console.log(
      `\n[email:log] —— ${params.subject} —— to ${params.to}\n${
        info.message?.toString() || ""
      }\n[email:log] ——`
    );
    return { delivered: false, mode: "log", messageId: info.messageId };
  } catch (err: any) {
    return { delivered: false, mode: "log", error: err?.message };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
