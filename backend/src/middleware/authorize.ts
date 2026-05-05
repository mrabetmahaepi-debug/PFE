import { Request, Response, NextFunction } from "express";
import prisma from "../prisma/prismaClient";

/**
 * Middleware to check if the authenticated user has a specific permission.
 * SuperAdmin bypasses all permission checks.
 */
export const authorize = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ message: "Utilisateur non authentifié" });
      }

      // 1. SuperAdmin bypass
      if (user.role === "SuperAdmin") {
        return next();
      }

      // 2. Fetch the user's role and its permissions from the database
      // We use the role ID from the token for maximum reliability, fallback to name/enterprise
      let roleWithPermissions;
      
      if (user.id_role) {
        roleWithPermissions = await prisma.role.findUnique({
          where: { id_role: user.id_role },
          include: { permissions: true }
        });
      } else {
        roleWithPermissions = await prisma.role.findFirst({
          where: {
            nom: user.role,
            id_entreprise: user.id_entreprise
          },
          include: { permissions: true }
        });
      }

      if (!roleWithPermissions) {
        return res.status(403).json({ message: "Rôle non trouvé ou invalide" });
      }

      // 3. Check if the required permission is assigned to the role
      const hasPermission = roleWithPermissions.permissions.some(
        (p) => p.nom === permission
      );

      if (!hasPermission) {
        return res.status(403).json({ 
          message: `Accès refusé : vous n'avez pas la permission '${permission}'` 
        });
      }

      next();
    } catch (error) {
      console.error("Authorization middleware error:", error);
      res.status(500).json({ message: "Erreur lors de la vérification des permissions" });
    }
  };
};
