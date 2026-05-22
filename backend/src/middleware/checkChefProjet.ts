import { Request, Response, NextFunction } from "express";
import { isSuperAdmin, userHasPermission } from "./permissions";

/**
 * Legacy middleware kept for backward compatibility.
 *
 * Previous behavior: required req.user.role === "Chef de Projet" or "Admin".
 *
 * New behavior:
 *  1. SuperAdmin → allowed.
 *  2. User has the canonical permission `SPRINT_MANAGE` → allowed.
 *  3. Fallback: legacy role names "Admin" / "Chef de Projet" → allowed.
 *
 * Step 3 is a transition path: as soon as the seed has run and roles have
 * `SPRINT_MANAGE`, step 2 takes over and step 3 simply never matches.
 * It guarantees nothing breaks during the rollout.
 */
const LEGACY_ROLE_ALLOWLIST = new Set([
  "ADMIN",
  "CHEF DE PROJET",
  "CHEF DE PROJECT",
]);

export const checkChefProjet = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ message: "Utilisateur non authentifié" });
  }

  if (isSuperAdmin(user)) return next();

  try {
    if (await userHasPermission(req, "SPRINT_MANAGE")) return next();
  } catch (err) {
    console.error("checkChefProjet permission lookup error:", err);
  }

  const role = String(user.role || "")
    .trim()
    .toUpperCase();
  if (LEGACY_ROLE_ALLOWLIST.has(role)) return next();

  return res
    .status(403)
    .json({ message: "Accès refusé : gestion de sprint requise" });
};
