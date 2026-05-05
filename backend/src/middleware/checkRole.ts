import { Request, Response, NextFunction } from "express";

export const checkRole = (role: string) => {
  return (req: any, res: Response, next: NextFunction) => {

    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
};
