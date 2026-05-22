import { Request, Response } from "express";
import {
  PROJECT_PERMISSION_KEYS,
  PROJECT_PERMISSION_LABELS_FR,
  PROJECT_ROLE_BUCKETS,
  PROJECT_ROLE_LABELS_FR,
} from "../lib/projectRolePermissions";
import {
  deleteEnterpriseProjectRoleConfig,
  getEnterpriseProjectRoleMatrix,
  saveEnterpriseProjectRoleMatrix,
} from "../services/enterpriseProjectRoleConfig.service";

function requireEnterpriseId(req: Request, res: Response): number | null {
  const user = (req as any).user;
  const id = user?.id_entreprise;
  if (id == null || !Number.isFinite(Number(id)) || Number(id) < 1) {
    res.status(400).json({
      message:
        "Une entreprise est requise pour gérer les permissions par rôle projet.",
    });
    return null;
  }
  return Number(id);
}

export const getProjectRolePermissionMatrix = async (
  req: Request,
  res: Response
) => {
  try {
    const id_entreprise = requireEnterpriseId(req, res);
    if (id_entreprise == null) return;

    const matrix = await getEnterpriseProjectRoleMatrix(id_entreprise);
    res.json({
      matrix,
      roleLabels: PROJECT_ROLE_LABELS_FR,
      roleOrder: [...PROJECT_ROLE_BUCKETS],
      permissionSlugs: [...PROJECT_PERMISSION_KEYS],
      permissionLabels: PROJECT_PERMISSION_LABELS_FR,
    });
  } catch (e: any) {
    res.status(500).json({ message: e?.message || "Erreur serveur" });
  }
};

export const putProjectRolePermissionMatrix = async (
  req: Request,
  res: Response
) => {
  try {
    const id_entreprise = requireEnterpriseId(req, res);
    if (id_entreprise == null) return;

    const body = req.body?.matrix ?? req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ message: "Body invalide (matrix attendue)" });
    }

    const saved = await saveEnterpriseProjectRoleMatrix(id_entreprise, body);
    res.json({ matrix: saved });
  } catch (e: any) {
    const msg = e?.message || "Erreur serveur";
    if (String(msg).includes("Au moins une permission")) {
      return res.status(400).json({ message: msg });
    }
    res.status(500).json({ message: msg });
  }
};

export const deleteProjectRolePermissionMatrix = async (
  req: Request,
  res: Response
) => {
  try {
    const id_entreprise = requireEnterpriseId(req, res);
    if (id_entreprise == null) return;

    await deleteEnterpriseProjectRoleConfig(id_entreprise);
    const matrix = await getEnterpriseProjectRoleMatrix(id_entreprise);
    res.json({ matrix });
  } catch (e: any) {
    res.status(500).json({ message: e?.message || "Erreur serveur" });
  }
};
