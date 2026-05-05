import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { errorResponse } from "../utils/response";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("Global Error:", err);

  if (err instanceof ZodError) {
    const zodErr = err as any;
    const formattedErrors = zodErr.errors.map((e: any) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    return errorResponse(res, "Erreur de validation des données", 400, formattedErrors);
  }

  // Si l'erreur est une instance de Error standard avec un message connu
  if (err instanceof Error) {
    const statusCode = err.message.includes("inexistant") || err.message.includes("non trouvé") ? 404 : 
                      err.message.includes("obligatoire") || err.message.includes("invalide") ? 400 : 500;
    
    return errorResponse(res, err.message, statusCode);
  }

  return errorResponse(res, "Erreur interne du serveur", 500);
};
