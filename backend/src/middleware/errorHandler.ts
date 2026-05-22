import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { errorResponse } from "../utils/response";
import { logger } from "../lib/logger";

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof ZodError || err?.name === "ZodError") {
    const issues = (err as any).issues ?? (err as any).errors ?? [];
    const formattedErrors = issues.map((e: any) => ({
      field: Array.isArray(e.path) ? e.path.join(".") : String(e.path ?? ""),
      message: e.message,
    }));
    return errorResponse(
      res,
      "Erreur de validation des données",
      400,
      formattedErrors
    );
  }

  logger.error("Unhandled error", {
    message: err?.message,
    name: err?.name,
  });

  if (err instanceof Error) {
    const msg = err.message;
    const statusCode =
      msg.includes("inexistant") || msg.includes("non trouvé")
        ? 404
        : msg.includes("obligatoire") || msg.includes("invalide")
        ? 400
        : 500;
    return errorResponse(res, msg, statusCode);
  }

  return errorResponse(res, "Erreur interne du serveur", 500);
};
