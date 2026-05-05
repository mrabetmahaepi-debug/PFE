import { Request, Response, NextFunction } from "express";

export const checkSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;

  if (!user || user.role !== "SuperAdmin") {
    return res.status(403).json({ message: "Access denied" });
  }

  next();
};

