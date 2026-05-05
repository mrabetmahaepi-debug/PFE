import "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        id_utilisateur?: number;
        email?: string;
        role: string;
        id_entreprise?: number;
      };
    }
  }
}
