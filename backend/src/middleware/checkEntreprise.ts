import { Request, Response, NextFunction } from "express";

export const checkEntreprise = (req: any, res: Response, next: NextFunction) => {

  const user = req.user;

  if (!user || !user.id_entreprise) {
    return res.status(403).json({
      error: "Utilisateur non associé à une entreprise"
    });
  }

  next();
};