import { Request, Response, NextFunction } from "express";

export const checkChefProjet = (req: any, res: Response, next: NextFunction) => {
  if (!req.user || (req.user.role !== "Chef de Projet" && req.user.role !== "Admin")) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};