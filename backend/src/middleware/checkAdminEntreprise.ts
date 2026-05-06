import { Request, Response, NextFunction } from "express";

export const checkAdminEntreprise = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
   

  if (!user) {
    return res.status(403).json({ error: "Accès refusé, vous devez être connecté" });
  }

  const role = user.role?.toString().toUpperCase();
  
  if (role === "SUPERADMIN") {
    return next();
  }

  if (role === "ADMIN" && user.id_entreprise) {
    return next();
  }

  return res.status(403).json({ error: "Accès refusé, vous devez être admin ou superadmin" });
};