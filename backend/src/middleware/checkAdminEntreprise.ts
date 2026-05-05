import { Request, Response, NextFunction } from "express";

export const checkAdminEntreprise = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
   

  if (!user) {
    return res.status(403).json({ error: "Accès refusé, vous devez être connecté" });
  }

  
  if (user.role === "SuperAdmin") {
    return next();
  }

  if (user.role === "Admin" && user.id_entreprise) {
    return next();
  }

  return res.status(403).json({ error: "Accès refusé, vous devez être admin ou superadmin" });
};