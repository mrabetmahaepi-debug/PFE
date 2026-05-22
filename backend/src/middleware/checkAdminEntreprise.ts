import { Request, Response, NextFunction } from "express";
import { isEnterpriseAdmin, isSuperAdmin } from "./permissions";

/**
 * Tenant-scoped guard: SuperAdmin OR enterprise admin attached to an enterprise.
 */
export const checkAdminEntreprise = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = (req as any).user;
  if (!user) {
    return res
      .status(401)
      .json({ error: "Accès refusé, vous devez être connecté" });
  }

  if (isSuperAdmin(user)) return next();

  if (isEnterpriseAdmin(user)) return next();

  return res.status(403).json({
    error: "Accès refusé, vous devez être administrateur d'entreprise",
  });
};
