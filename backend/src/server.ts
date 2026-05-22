import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import {
  DOTENV_LOAD_REPORT,
  env,
  getResolvedEnvEmailFlags,
  trimEnvValue,
} from "./config/env";
import { logger } from "./lib/logger";
import prisma from "./prisma/prismaClient";
import { isUsingDefaultJwtSecret } from "./utils/jwt";
import { getSafeEmailBootstrapDiagnostics } from "./services/email.service";

// ── Auth & user-profile ────────────────────────────────────────────────────
import authRoutes from "./modules/auth/routes";
import userRoutes from "./modules/user-profile/routes";
import meRoutes from "./routes/meRoutes";

// ── AI / smart features ───────────────────────────────────────────────────
import notificationRoutes from "./modules/notifications/routes";
import chatbotRoutes from "./modules/chatbot/routes";
import aiRoutes from "./modules/ai/routes";
import badgeRoutes from "./modules/badges/routes";
import recommendationRoutes from "./modules/recommendations/routes";

// ── Company & access management ───────────────────────────────────────────
import entrepriseRoutes from "./modules/enterprises/routes";
import invitationRoutes from "./modules/invitations/routes";
import utilisateurRoutes from "./modules/users/routes";
import roleRoutes from "./modules/roles/routes";
import permissionRoutes from "./modules/permissions/routes";

// ── Project management ────────────────────────────────────────────────────
import projetRoutes from "./modules/projects/routes";
import spaceRoutes from "./modules/spaces/routes";
import groupRoutes from "./modules/groups/routes";
import folderRoutes from "./modules/folders/routes";
import sprintRoutes from "./modules/sprints/routes";
import listRoutes from "./modules/lists/routes";
import tacheRoutes from "./modules/tasks/routes";
import affectationRoutes from "./modules/assignments/routes";
import superAdminRoutes from "./modules/super-admin/routes";
import alertRoutes from "./modules/alerts/routes";
import accessRoutes from "./modules/access/routes";
import messagingRoutes from "./modules/messaging/routes";
import activityRoutes from "./modules/activity/routes";
import uploadRoutes from "./modules/upload/routes";

const app = express();
const PORT = env.port;
const isProduction = process.env.NODE_ENV === "production";

// ── Global middleware ─────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

/** CORS: en prod, restreindre avec FRONTEND_URL (séparateur virgule si plusieurs origines). */
const corsAllowedOrigins = () => {
  const raw = trimEnvValue(process.env.FRONTEND_URL);
  if (!raw) return null;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (!isProduction) {
        callback(null, true);
        return;
      }
      const list = corsAllowedOrigins();
      if (!list?.length) {
        callback(null, true);
        return;
      }
      callback(null, list.includes(origin));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));
app.use("/uploads", express.static("uploads"));

// ── Rate limiters ─────────────────────────────────────────────────────────
/** Invitation public endpoints — skip in development; production stays capped per IP. */
const invitationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  skip: () => !isProduction,
  message: {
    message: "Trop de tentatives. Réessayez dans environ 1 heure.",
    code: "INVITATION_RATE_LIMITED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    const retryAfterSec = Math.ceil(options.windowMs / 1000);
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(429).json({
      message: "Trop de tentatives. Réessayez dans environ 1 heure.",
      code: "INVITATION_RATE_LIMITED",
      retryAfterSeconds: retryAfterSec,
    });
  },
});

// ── Health check ──────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "API Gestion Projet fonctionne" });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "gestion-projet-api" });
});

// ── Public routes (no auth required) ─────────────────────────────────────
// Login rate limit is applied only on POST /auth/login (see loginRateLimiter).
// Do not limit GET /auth/me — it would block normal session refresh and mimic a "stuck" login.
app.use("/api/auth", authRoutes);

// Invitations: public token endpoints have their own limiter, the rest stays under invitationRoutes
app.use("/api/invitations", invitationLimiter, invitationRoutes);

// ── Authenticated routes ──────────────────────────────────────────────────
app.use("/api/users", userRoutes);
app.use("/api/me", meRoutes);

app.use("/api/notifications", notificationRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/badges", badgeRoutes);
app.use("/api/recommendations", recommendationRoutes);

app.use("/api/entreprises", entrepriseRoutes);
app.use("/api/utilisateurs", utilisateurRoutes); // admin user management

app.use("/api/roles", roleRoutes);
app.use("/api/permissions", permissionRoutes);

app.use("/api/projets", projetRoutes);
app.use("/api/projects", projetRoutes);
app.use("/api/spaces", spaceRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/folders", folderRoutes);
app.use("/api/sprints", sprintRoutes);
app.use("/api/lists", listRoutes);
app.use("/api/taches", tacheRoutes);
app.use("/api/tasks", tacheRoutes);
app.use("/api/affectations", affectationRoutes);
app.use("/api/superadmin", superAdminRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/access", accessRoutes);
app.use("/api/messaging", messagingRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/upload", uploadRoutes);

// Register Global Error Handler
import { errorHandler } from "./middleware/errorHandler";
app.use(errorHandler);

const dbUrlPresent = !!trimEnvValue(env.databaseUrl);
const jwtConfigured = !isUsingDefaultJwtSecret();

if (!dbUrlPresent) {
  logger.error("[config] DATABASE_URL est manquant ou vide. Arrêt.");
  process.exit(1);
}
if (isProduction && !jwtConfigured) {
  logger.error(
    "[config] JWT_SECRET doit être défini en production (pas de secret par défaut)."
  );
  process.exit(1);
}
if (!isProduction && !jwtConfigured) {
  logger.warn(
    "[config] JWT_SECRET absent — utilisation du secret de développement (ne pas utiliser en production)."
  );
}

void prisma
  .$connect()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`API listening on http://localhost:${PORT}`);
      logger.info("[config:bootstrap] environment & email (safe)", {
        databaseReachable: true,
        jwtSecretConfigured: jwtConfigured,
        dotenvResolvedPath: DOTENV_LOAD_REPORT.resolvedPath,
        dotenvFileExists: DOTENV_LOAD_REPORT.fileExists,
        dotenvEntryCount: DOTENV_LOAD_REPORT.entryCount,
        ...(DOTENV_LOAD_REPORT.loadErrorMessage
          ? { dotenvLoadError: DOTENV_LOAD_REPORT.loadErrorMessage }
          : {}),
        ...getResolvedEnvEmailFlags(),
        ...getSafeEmailBootstrapDiagnostics(),
      });
    });
  })
  .catch((err) => {
    logger.error("[config] Connexion à la base de données impossible", {
      message: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  });

export default app;
