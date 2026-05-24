import { Request, Response, NextFunction } from "express";
import {
  registerUser,
  loginUser,
  getMe,
  AuthError,
  markUserOffline,
  type UserProjectRoleRow,
} from "../services/auth.service";
import { resolveProjectPosteLabel } from "../lib/projectRoleLabels";
import prisma from "../prisma/prismaClient";
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from "../services/passwordReset.service";
import { generateToken } from "../utils/jwt";
import { logRoleAssignment } from "../lib/roleAssignmentLog";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../modules/auth/auth.schema";

export const registerController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const user = await registerUser(parsed);
    return res.status(201).json({
      id: user.id_utilisateur,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      statut: user.statut,
    });
  } catch (err: any) {
    if (err?.name === "ZodError") return next(err);
    return res.status(400).json({ message: err.message });
  }
};

export const loginController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const user = await loginUser(parsed.email, parsed.password);

    const token = generateToken(user);

    const roleName = user.role?.nom ?? "Membre";
    const name =
      `${user.prenom || ""} ${user.nom || ""}`.trim() ||
      user.email ||
      "Utilisateur";

    const posteRaw = (user as { poste?: string | null }).poste;
    const poste = posteRaw?.trim()
      ? resolveProjectPosteLabel(posteRaw)
      : undefined;

    let projectRoles: UserProjectRoleRow[] = [];
    try {
      const rows = await prisma.membre_projet.findMany({
        where: { id_utilisateur: user.id_utilisateur },
        select: {
          id_projet: true,
          role_projet: true,
          projet: { select: { nom_p: true } },
        },
        orderBy: { id_projet: "asc" },
      });
      projectRoles = rows.map((r) => ({
        id_projet: r.id_projet,
        nom_p: r.projet?.nom_p?.trim() || `Projet #${r.id_projet}`,
        role_projet: resolveProjectPosteLabel(r.role_projet),
      }));
    } catch (err) {
      console.warn("[auth] login projectRoles fetch failed:", err);
    }

    logRoleAssignment("login", {
      selectedRole: null,
      savedRole: poste ?? null,
      loadedRole: poste ?? user.poste ?? null,
      globalRoleNom: roleName,
      poste: poste ?? user.poste ?? null,
      userId: user.id_utilisateur,
      email: user.email,
    });

    return res.json({
      token,
      user: {
        id: user.id_utilisateur,
        name,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: roleName,
        id_role: user.id_role,
        id_entreprise: user.id_entreprise ?? undefined,
        poste,
        projectRoles,
      },
      role: roleName,
      id_role: user.id_role,
      poste,
      projectRoles,
    });
  } catch (err: any) {
    if (err?.name === "ZodError") return next(err);
    if (err instanceof AuthError) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }
    const code = err?.code;
    const isPrismaSchema =
      typeof code === "string" &&
      (code === "P2022" || code === "P2010" || code === "P2001");
    if (isPrismaSchema) {
      console.error("[auth] login Prisma error:", err);
      return res.status(503).json({
        message:
          "Service temporairement indisponible (base de données). Vérifiez les migrations Prisma.",
        code: "AUTH_DB_SCHEMA",
      });
    }
    console.error("[auth] login unexpected error:", err);
    const short =
      typeof err?.message === "string" && err.message.length > 0
        ? err.message.slice(0, 240)
        : "UNKNOWN";
    return res.status(500).json({
      message: "Erreur lors de la connexion",
      error: short,
    });
  }
};

export const logoutController = async (req: any, res: Response) => {
  try {
    const uid = Number(req.user?.id);
    if (!Number.isFinite(uid)) {
      return res.status(401).json({ message: "Token invalide", code: "AUTH_INVALID" });
    }
    await markUserOffline(uid);
    return res.status(204).send();
  } catch (err: any) {
    console.error("[auth] logout error:", err);
    return res.status(500).json({ message: err?.message || "Erreur serveur" });
  }
};

export const forgotPasswordController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = forgotPasswordSchema.parse(req.body);
    const result = await requestPasswordReset(parsed.email);
    return res.json(result);
  } catch (err: any) {
    if (err?.name === "ZodError") return next(err);
    if (err instanceof AuthError) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }
    console.error("[auth] forgot-password error:", err);
    return res.status(500).json({ message: "Erreur lors de l'envoi du lien de réinitialisation." });
  }
};

export const resetPasswordController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = resetPasswordSchema.parse(req.body);
    const result = await resetPasswordWithToken(parsed.token, parsed.password);
    return res.json(result);
  } catch (err: any) {
    if (err?.name === "ZodError") return next(err);
    if (err instanceof AuthError) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }
    console.error("[auth] reset-password error:", err);
    return res.status(500).json({ message: "Erreur lors de la réinitialisation du mot de passe." });
  }
};

export const meController = async (req: any, res: Response) => {
  try {
    const uid = Number(req.user?.id);
    if (!Number.isFinite(uid)) {
      return res.status(401).json({ message: "Token invalide", code: "AUTH_INVALID" });
    }
    const user = await getMe(uid);
    return res.json({
      ...user,
      id_role: user.id_role,
    });
  } catch (err: any) {
    if (err?.message === "Utilisateur non trouvé") {
      return res.status(401).json({ message: "Utilisateur introuvable", code: "AUTH_INVALID" });
    }
    console.error("[auth] getMe error:", err);
    const short =
      typeof err?.message === "string" && err.message.length > 0
        ? err.message.slice(0, 240)
        : "UNKNOWN";
    return res.status(500).json({
      message: "Impossible de charger le profil utilisateur",
      error: short,
    });
  }
};
