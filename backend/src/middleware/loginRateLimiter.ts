import type { Request, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { logger } from "../lib/logger";

const WINDOW_MS = 15 * 60 * 1000;

const isProduction = process.env.NODE_ENV === "production";

/**
 * Production: limit brute-force on POST /login only (not /me, /register, etc.).
 * Key = IP + normalized email so one noisy client does not block unrelated accounts.
 * Successful logins (2xx) are not counted (`skipSuccessfulRequests`).
 *
 * Development: disabled entirely so local testing is not blocked.
 */
export const loginRateLimiter: RequestHandler = isProduction
  ? rateLimit({
      windowMs: WINDOW_MS,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      keyGenerator: (req: Request) => {
        const ip = req.ip || req.socket?.remoteAddress || "unknown";
        const raw =
          typeof req.body?.email === "string"
            ? req.body.email.trim().toLowerCase()
            : "";
        return `${ip}:${raw || "no-email"}`;
      },
      handler: (req, res, _next, options) => {
        const retryAfterSec = Math.ceil(options.windowMs / 1000);
        const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
        logger.warn("[auth:rate-limit] login temporarily blocked", {
          ip: req.ip,
          path: req.path,
        });
        res.setHeader("Retry-After", String(retryAfterSec));
        res.status(429).json({
          message: `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`,
          code: "AUTH_RATE_LIMITED",
          retryAfterSeconds: retryAfterSec,
        });
      },
    })
  : ((_req, _res, next) => {
      next();
    }) as RequestHandler;
