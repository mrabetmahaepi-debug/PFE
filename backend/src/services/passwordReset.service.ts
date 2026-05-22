import crypto from "crypto";
import bcrypt from "bcrypt";
import prisma from "../prisma/prismaClient";
import { AuthError } from "./auth.service";
import { env } from "../config/env";
import { sendEmail, isEmailConfigured } from "./email.service";
import { buildPasswordResetEmail } from "./emailTemplates/passwordResetEmail";

/** Password reset link validity (1 hour). */
const RESET_TTL_MS = 60 * 60 * 1000;

function buildPasswordResetLink(token: string): string {
  const base =
    env.frontendUrl ||
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    "http://localhost:5173";
  return `${String(base).replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}

function canResetPassword(statut: string | null | undefined): boolean {
  const s = statut == null || statut === "" ? "ACTIVE" : statut;
  if (s === "INVITATION_PENDING") return false;
  if (s === "PENDING") return false;
  if (s === "REJECTED") return false;
  return s === "ACTIVE";
}

export async function requestPasswordReset(email: string) {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.utilisateur.findUnique({
    where: { email: normalized },
    select: {
      id_utilisateur: true,
      email: true,
      password: true,
      statut: true,
      prenom: true,
      nom: true,
    },
  });

  if (!user) {
    throw new AuthError(
      "Aucun compte associé à cet email.",
      404,
      "AUTH_RESET_EMAIL_NOT_FOUND"
    );
  }

  if (!user.password) {
    throw new AuthError(
      "Ce compte n'a pas encore de mot de passe. Utilisez le lien d'invitation reçu par email.",
      400,
      "AUTH_RESET_NO_PASSWORD"
    );
  }

  if (!canResetPassword(user.statut)) {
    throw new AuthError(
      "Ce compte n'est pas actif. Contactez un administrateur.",
      403,
      "AUTH_INACTIVE"
    );
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + RESET_TTL_MS);

  await prisma.utilisateur.update({
    where: { id_utilisateur: user.id_utilisateur },
    data: {
      password_reset_token: token,
      password_reset_expires: expires,
    },
  });

  const resetUrl = buildPasswordResetLink(token);
  const emailContent = buildPasswordResetEmail({
    resetUrl,
    expiresMinutes: 60,
  });

  if (isEmailConfigured()) {
    await sendEmail({
      to: user.email!,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
  } else {
    console.info("[password-reset] email not configured — reset link for dev:", resetUrl);
  }

  return {
    message:
      "Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.",
  };
}

export async function resetPasswordWithToken(token: string, password: string) {
  const trimmedToken = (token || "").trim();
  if (!trimmedToken) {
    throw new AuthError(
      "Lien de réinitialisation invalide.",
      400,
      "AUTH_RESET_TOKEN_INVALID"
    );
  }

  const user = await prisma.utilisateur.findFirst({
    where: { password_reset_token: trimmedToken },
    select: {
      id_utilisateur: true,
      password_reset_expires: true,
      statut: true,
    },
  });

  if (!user) {
    throw new AuthError(
      "Lien de réinitialisation invalide ou déjà utilisé.",
      400,
      "AUTH_RESET_TOKEN_INVALID"
    );
  }

  if (!user.password_reset_expires || user.password_reset_expires.getTime() < Date.now()) {
    await prisma.utilisateur.update({
      where: { id_utilisateur: user.id_utilisateur },
      data: { password_reset_token: null, password_reset_expires: null },
    });
    throw new AuthError(
      "Ce lien a expiré. Demandez un nouveau lien de réinitialisation.",
      400,
      "AUTH_RESET_TOKEN_EXPIRED"
    );
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.utilisateur.update({
    where: { id_utilisateur: user.id_utilisateur },
    data: {
      password: hashed,
      password_reset_token: null,
      password_reset_expires: null,
    },
  });

  return { message: "Mot de passe mis à jour avec succès." };
}
