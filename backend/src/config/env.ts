import fs from "fs";
import path from "path";
import dotenv from "dotenv";

/**
 * Prefer `backend/.env` regardless of process.cwd().
 *
 * We intentionally avoid `dotenv.config()`: when `DOTENV_KEY` is defined, dotenv ≥17
 * may try `.env.vault` first and never apply your plain `.env` the way we expect.
 *
 * Here the resolved file is always read, parsed, then merged into `process.env`
 * with `override: true` so empty OS-level placeholders cannot win.
 */
const backendRootEnvPath = path.resolve(__dirname, "..", "..", ".env");
const cwdEnvPath = path.resolve(process.cwd(), ".env");

export const DOTENV_RESOLVED_PATH = fs.existsSync(backendRootEnvPath)
  ? backendRootEnvPath
  : fs.existsSync(cwdEnvPath)
    ? cwdEnvPath
    : backendRootEnvPath;

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, "");
}

/** Trim + safely strip redundant outer quotes — never strips valid inner characters. */
export function trimEnvValue(v: string | undefined): string {
  if (v == null) return "";
  let t = String(v).trim();
  if (t.length >= 2) {
    const a = t[0];
    const b = t[t.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
      t = t.slice(1, -1).trim();
    }
  }
  return t;
}

/** Snapshot of `.env` file contents post-parse (never log raw values). */
let parsedEnvFile: Record<string, string> = {};

let envFileLoadErrorMessage: string | null = null;

function loadResolvedEnvIntoProcessEnv(): void {
  envFileLoadErrorMessage = null;
  if (!fs.existsSync(DOTENV_RESOLVED_PATH)) {
    parsedEnvFile = {};
    return;
  }
  try {
    const raw = stripBom(fs.readFileSync(DOTENV_RESOLVED_PATH, "utf8"));
    parsedEnvFile = dotenv.parse(raw);
    dotenv.populate(process.env as NodeJS.ProcessEnv, parsedEnvFile, {
      override: true,
    });
  } catch (err) {
    parsedEnvFile = {};
    envFileLoadErrorMessage =
      err instanceof Error ? err.message : String(err);
    console.warn("[config:env] échec parse/chargement .env", {
      resolvedPath: DOTENV_RESOLVED_PATH,
      message: envFileLoadErrorMessage,
    });
  }
}

loadResolvedEnvIntoProcessEnv();

export const DOTENV_LOAD_REPORT = {
  pathTriedFirst: backendRootEnvPath,
  cwd: process.cwd(),
  resolvedPath: DOTENV_RESOLVED_PATH,
  fileExists: fs.existsSync(DOTENV_RESOLVED_PATH),
  entryCount: Object.keys(parsedEnvFile).length,
  loadErrorMessage: envFileLoadErrorMessage,
} as const;

if (!DOTENV_LOAD_REPORT.fileExists) {
  console.warn(
    "[config:env] aucun fichier .env trouvé (variables manquantes en dev)",
    {
      expectedNearBackendPackage: backendRootEnvPath,
      cwdFallback: cwdEnvPath,
      cwd: process.cwd(),
    }
  );
}

export const env = {
  port: process.env.PORT || "5000",
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  /** Used for invitation links and other absolute URLs toward the SPA. */
  frontendUrl:
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    undefined,
};

/**
 * Canonical transactional-email fields. Uses the file snapshot first, then falls
 * back to `process.env` (e.g. values injected only by the host in production).
 */
export function getEmailTransportEnv(): {
  brevoApiKey: string;
  emailFrom: string;
  emailReplyTo: string;
} {
  const fromFile = parsedEnvFile;
  return {
    brevoApiKey: trimEnvValue(
      fromFile["BREVO_API_KEY"] ?? process.env.BREVO_API_KEY
    ),
    emailFrom: trimEnvValue(
      fromFile["EMAIL_FROM"] ?? process.env.EMAIL_FROM
    ),
    emailReplyTo: trimEnvValue(
      fromFile["EMAIL_REPLY_TO"] ?? process.env.EMAIL_REPLY_TO
    ),
  };
}

/** Safe booleans for startup logs — file vs `process.env` vs canonical transport export. */
export function getResolvedEnvEmailFlags() {
  const fileBrevo = trimEnvValue(parsedEnvFile["BREVO_API_KEY"]);
  const fileFrom = trimEnvValue(parsedEnvFile["EMAIL_FROM"]);
  const procBrevo = trimEnvValue(process.env.BREVO_API_KEY);
  const procFrom = trimEnvValue(process.env.EMAIL_FROM);
  const ex = getEmailTransportEnv();

  return {
    parsedFileHasBrevo: fileBrevo.length > 0,
    processEnvHasBrevo: procBrevo.length > 0,
    exportedConfigHasBrevo: ex.brevoApiKey.length > 0,
    parsedFileHasEmailFrom: fileFrom.length > 0,
    processEnvHasEmailFrom: procFrom.length > 0,
    exportedConfigHasEmailFrom: ex.emailFrom.length > 0,
  };
}
