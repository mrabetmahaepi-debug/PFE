import { Request, Response } from "express";
import { isEnterpriseAdmin, isSuperAdmin } from "../middleware/permissions";
import {
  getUserAccessSnapshot,
  saveUserAccess,
} from "../services/userAccessManagement.service";

function parseUserId(raw: string | undefined): number | null {
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

function tenantGuard(req: Request, res: Response): {
  adminId: number;
  enterpriseId: number;
} | null {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ message: "Utilisateur non authentifié" });
    return null;
  }
  if (!isSuperAdmin(user) && !isEnterpriseAdmin(user)) {
    res.status(403).json({ message: "Réservé aux administrateurs" });
    return null;
  }
  const enterpriseId = Number(user.id_entreprise);
  const adminId = Number(user.id);
  if (!Number.isFinite(enterpriseId) || enterpriseId <= 0) {
    res.status(400).json({ message: "Entreprise introuvable" });
    return null;
  }
  return { adminId, enterpriseId };
}

/**
 * GET /api/me/admin/users/:userId/access
 */
export const getUserAccessController = async (req: Request, res: Response) => {
  try {
    const guard = tenantGuard(req, res);
    if (!guard) return;

    const userId = parseUserId(String(req.params.userId ?? ""));
    if (!userId) {
      return res.status(400).json({ message: "Identifiant utilisateur invalide" });
    }

    const snapshot = await getUserAccessSnapshot(userId, guard.enterpriseId);
    if (!snapshot) {
      return res.status(404).json({ message: "Utilisateur introuvable dans votre entreprise" });
    }

    return res.json(snapshot);
  } catch (err) {
    console.error("getUserAccessController error:", err);
    return res.status(500).json({ message: "Impossible de charger les accès utilisateur" });
  }
};

/**
 * PUT /api/me/admin/users/:userId/access
 */
export const saveUserAccessController = async (req: Request, res: Response) => {
  try {
    const guard = tenantGuard(req, res);
    if (!guard) return;

    const userId = parseUserId(String(req.params.userId ?? ""));
    if (!userId) {
      return res.status(400).json({ message: "Identifiant utilisateur invalide" });
    }

    const target = await getUserAccessSnapshot(userId, guard.enterpriseId);
    if (!target) {
      return res.status(404).json({ message: "Utilisateur introuvable dans votre entreprise" });
    }

    const projects = Array.isArray(req.body?.projects) ? req.body.projects : [];
    const features = Array.isArray(req.body?.features) ? req.body.features : [];

    await saveUserAccess({
      userId,
      enterpriseId: guard.enterpriseId,
      grantedById: guard.adminId,
      projects,
      features,
    });

    return res.json({ ok: true, userId });
  } catch (err) {
    console.error("saveUserAccessController error:", err);
    const message =
      err instanceof Error ? err.message : "Impossible d'enregistrer les accès utilisateur";
    const isValidation =
      /hors de l'entreprise|n'appartient pas|introuvable/i.test(message);
    return res.status(isValidation ? 400 : 500).json({ message });
  }
};
