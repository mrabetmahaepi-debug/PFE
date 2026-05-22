import { Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import prisma from "../prisma/prismaClient";

/** Throttle DB writes for lastSeen / isOnline on authenticated traffic. */
const presenceLastWriteMs = new Map<number, number>();
const PRESENCE_THROTTLE_MS = 45_000;

function touchPresenceFromAuth(userId: number) {
  const now = Date.now();
  const prev = presenceLastWriteMs.get(userId) ?? 0;
  if (now - prev < PRESENCE_THROTTLE_MS) return;
  presenceLastWriteMs.set(userId, now);
  void prisma.utilisateur
    .update({
      where: { id_utilisateur: userId },
      data: { isOnline: true, lastSeen: new Date() },
    })
    .catch((err) => console.warn("[authMiddleware] presence touch failed:", err));
}

/**
 * Verifies JWT, then loads the current user from the database so `req.user.role`
 * and `statut` stay aligned with Prisma (fixes SuperAdmin / permission drift from
 * stale token payloads).
 */
export const authMiddleware = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token manquant" });
  }

  const token = authHeader.split(" ")[1];

  let decoded: { id?: number };
  try {
    decoded = verifyToken(token) as { id?: number };
  } catch {
    return res.status(401).json({ message: "Token invalide" });
  }

  const id = Number(decoded.id);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(401).json({ message: "Token invalide" });
  }

  try {
    const user = await prisma.utilisateur.findUnique({
      where: { id_utilisateur: id },
      select: {
        id_utilisateur: true,
        email: true,
        id_role: true,
        id_entreprise: true,
        statut: true,
        role: { select: { nom: true } },
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Token invalide" });
    }

    const rawStatut = user.statut;
    const effectiveStatut =
      rawStatut == null || rawStatut === "" ? "ACTIVE" : rawStatut;

    if (effectiveStatut === "INVITATION_PENDING") {
      return res.status(401).json({
        message:
          "Activez votre compte via le lien d'invitation reçu par email avant de continuer.",
        code: "AUTH_INVITATION_PENDING",
      });
    }

    if (effectiveStatut !== "ACTIVE") {
      const pending = effectiveStatut === "PENDING";
      const rejected = effectiveStatut === "REJECTED";
      return res.status(401).json({
        message: pending
          ? "Votre compte est en attente de validation par l'administrateur."
          : rejected
            ? "Votre demande d'inscription a été refusée par l'administrateur."
            : "Votre compte n'est pas actif. Contactez un administrateur.",
        code: pending
          ? "AUTH_PENDING"
          : rejected
            ? "AUTH_REJECTED"
            : "AUTH_INACTIVE",
      });
    }

    req.user = {
      id: user.id_utilisateur,
      email: user.email ?? undefined,
      role: user.role?.nom ?? null,
      id_role: user.id_role ?? null,
      id_entreprise: user.id_entreprise ?? null,
    };
    const isLogout =
      req.method === "POST" &&
      (String(req.originalUrl || req.url || "").includes("/auth/logout") ||
        String(req.path || "").endsWith("/logout"));
    if (!isLogout) {
      touchPresenceFromAuth(user.id_utilisateur);
    }
    next();
  } catch (err) {
    console.error("[authMiddleware] DB error:", err);
    return res.status(500).json({ message: "Erreur d'authentification" });
  }
};