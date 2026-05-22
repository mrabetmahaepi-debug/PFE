import { Request, Response, NextFunction } from "express";
import prisma from "../prisma/prismaClient";
import { resolveTenantMembreRoleId } from "../lib/tenantMembreRole";
import { MessagingService } from "../services/messaging.service";
import {
  createInvitationSchema,
  createTeamInvitationSchema,
  acceptInvitationByTokenSchema,
} from "../modules/invitations/invitation.schema";
import {
  acceptInvitationByToken,
  createInvitation as createInvitationService,
  createTeamMemberPendingInvite,
  findInvitationByToken,
  findPendingInviteUserByToken,
  isInvitationUsable,
  isPendingInviteUserUsable,
  findRoleByName,
} from "../services/invitation.service";
import { sendEmail, isEmailConfigured, getEmailProviderInfo } from "../services/email.service";
import { buildInvitationEmail } from "../services/emailTemplates/invitationEmail";
import { createUtilisateurSafe } from "../lib/createUtilisateurSafe";

const ADMIN_ROLE_NAMES = ["Admin", "ADMIN", "admin"];

const buildInviterDisplayName = (inviter?: {
  prenom?: string | null;
  nom?: string | null;
  email?: string | null;
} | null) => {
  if (!inviter) return "Un administrateur";
  const full = `${inviter.prenom || ""} ${inviter.nom || ""}`.trim();
  if (full.length > 0) return full;
  return inviter.email || "Un administrateur";
};

const buildInvitationLink = (token: string) => {
  const base = (
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
  return `${base}/accept-invitation?token=${encodeURIComponent(token)}`;
};

export const createInvitation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = createInvitationSchema.parse(req.body);
    const inviter = (req as any).user;
    const invitation = await createInvitationService({
      email: parsed.email,
      id_role: parsed.id_role,
      id_entreprise: parsed.id_entreprise ?? null,
      prenom: parsed.prenom,
      nom: parsed.nom,
      id_invited_by: inviter?.id ?? null,
    });

    return res.status(201).json({
      message: "Invitation créée",
      invitation: {
        id_invitation: invitation.id_invitation,
        email: invitation.email,
        token: invitation.token,
        expires_at: invitation.expires_at,
        id_role: invitation.id_role,
        id_entreprise: invitation.id_entreprise,
      },
    });
  } catch (error: any) {
    if (error?.name === "ZodError") return next(error);
    return res.status(400).json({ error: error?.message || "Erreur création invitation" });
  }
};

/**
 * Tenant-scoped multi-email invitation creation, callable by any user with
 * the `TEAM_INVITE` permission. Behaves like the admin "Inviter par e-mail"
 * flow in modern SaaS tools (ClickUp/Linear).
 *
 * Security guarantees:
 *  - `id_entreprise` is forced from the authenticated user, never from the
 *    request body (prevents cross-tenant invites);
 *  - the target role must belong to the same enterprise (or be a global
 *    role visible to everyone), and cannot be a system-only role.
 *
 * Returns a structured per-email result so the UI can show successes,
 * skipped (duplicates), and failures in a single roundtrip.
 */
export const createTeamInvitations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = createTeamInvitationSchema.parse(req.body);
    const inviter = (req as any).user;
    const inviterId = Number(inviter?.id ?? inviter?.id_utilisateur);

    if (!inviter?.id_entreprise) {
      return res
        .status(403)
        .json({ message: "Aucune entreprise associée à votre compte" });
    }
    if (!Number.isFinite(inviterId) || inviterId <= 0) {
      console.error("[invite:team] invalid authenticated user payload", {
        user: inviter,
      });
      return res.status(401).json({
        message: "Session invalide : utilisateur introuvable dans le token",
      });
    }

    // Email is the production transport for this flow. If no provider
    // is configured we refuse to create invitations so admins never end
    // up relying on a manual "copy link" workaround as the main UX.
    if (!isEmailConfigured()) {
      console.warn(
        "[invite:team] refused: no email provider configured (Brevo or SMTP)"
      );
      return res.status(503).json({
        code: "EMAIL_NOT_CONFIGURED",
        message:
          "L'envoi d'email n'est pas configuré sur ce serveur. " +
          "Configurez Brevo (recommandé) ou un SMTP dans le fichier .env du backend, puis redémarrez l'API.",
        hint: {
          recommended_provider: "brevo",
          required_env: ["BREVO_API_KEY", "EMAIL_FROM"],
          example_brevo: {
            BREVO_API_KEY: "xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            EMAIL_FROM: "GestionPro <no-reply@yourdomain.com>",
            FRONTEND_URL: "http://localhost:5173",
          },
          alternative_smtp: {
            SMTP_HOST: "smtp.gmail.com",
            SMTP_PORT: 587,
            SMTP_SECURE: false,
            SMTP_USER: "your-account@gmail.com",
            SMTP_PASS: "your-gmail-app-password",
          },
        },
      });
    }

    console.info("[invite:team] email provider diagnostics", getEmailProviderInfo());

    const membreRoleId = await resolveTenantMembreRoleId(
      prisma,
      inviter.id_entreprise as number
    );
    if (!membreRoleId) {
      return res.status(503).json({
        message:
          "Le rôle global « Membre » est introuvable pour votre entreprise. Exécutez le script de provisionnement des rôles (seed) ou contactez le support.",
      });
    }

    // De-duplicate while preserving order so the response matches the input.
    const seen = new Set<string>();
    const uniqueEmails = parsed.emails.filter((email) => {
      if (seen.has(email)) return false;
      seen.add(email);
      return true;
    });

    // Fetch inviter + workspace details once for the email template.
    const [inviterRecord, enterprise] = await Promise.all([
      prisma.utilisateur.findUnique({
        where: { id_utilisateur: inviterId },
        select: { prenom: true, nom: true, email: true },
      }),
      prisma.entreprise.findUnique({
        where: { id_entreprise: inviter.id_entreprise },
        select: { nom: true },
      }),
    ]);

    const inviterDisplayName = buildInviterDisplayName(inviterRecord);
    const workspaceName = enterprise?.nom || "votre espace de travail";

    console.info("[invite:team] request accepted", {
      inviterId,
      inviterEmail: inviterRecord?.email || inviter.email || null,
      enterpriseId: inviter.id_entreprise,
      workspaceName,
      roleId: membreRoleId,
      roleName: "Membre",
      requestedEmails: parsed.emails.length,
      uniqueEmails: uniqueEmails.length,
      smtpConfigured: isEmailConfigured(),
    });

    const results: Array<
      | {
          email: string;
          status: "sent";
          token: string;
          link: string;
          expires_at: Date | null;
          id_utilisateur: number;
          email_delivery: "sent" | "skipped" | "failed";
          /** Populated when Brevo/SMTP rejects or times out. */
          delivery_error?: string;
        }
      | {
          email: string;
          status: "skipped" | "error";
          reason: string;
          code?: string;
        }
    > = [];

    for (const email of uniqueEmails) {
      try {
        const pendingUser = await createTeamMemberPendingInvite({
          email,
          id_role: membreRoleId,
          id_entreprise: inviter.id_entreprise as number,
          prenom: parsed.prenom,
          nom: parsed.nom,
          id_invited_by: inviterId,
        });

        const acceptUrl = buildInvitationLink(pendingUser.invitation_token!);

        let emailDelivery: "sent" | "skipped" | "failed" = "skipped";
        let lastDeliveryError: string | undefined;
        try {
          const built = buildInvitationEmail({
            workspaceName,
            inviterName: inviterDisplayName,
            inviterEmail: inviterRecord?.email,
            roleName: "Membre",
            acceptUrl,
            expiresAt: pendingUser.invitation_expires,
            appName: process.env.APP_NAME || "GestionPro",
          });
          console.info("[invite:team] invoking sendEmail (transactional provider)", {
            to: email,
            invitation_id: pendingUser.id_utilisateur,
            subject_preview:
              built.subject.length > 80
                ? `${built.subject.slice(0, 77)}…`
                : built.subject,
          });

          const sendResult = await sendEmail({
            to: email,
            subject: built.subject,
            html: built.html,
            text: built.text,
            replyTo: inviterRecord?.email || undefined,
          });

          console.info("[invite:team] sendEmail resolved", {
            email,
            invitationId: pendingUser.id_utilisateur,
            delivered: sendResult.delivered,
            mode: sendResult.mode,
            messageId: sendResult.messageId,
            transportError: sendResult.error || null,
          });

          if (sendResult.delivered) emailDelivery = "sent";
          else if (!isEmailConfigured()) emailDelivery = "skipped";
          else {
            emailDelivery = "failed";
            lastDeliveryError =
              sendResult.error || "Erreur d'envoi (aucun détail rapporté)";
          }

          console.info("[invite:team] email delivery result", {
            email,
            invitationId: pendingUser.id_utilisateur,
            delivery: emailDelivery,
            mode: sendResult.mode,
            messageId: sendResult.messageId,
            error: sendResult.error,
          });
        } catch (mailErr: any) {
          console.error("[invite:team] email template/send failed", {
            email,
            invitationId: pendingUser.id_utilisateur,
            error: mailErr,
          });
          emailDelivery = "failed";
          lastDeliveryError =
            mailErr?.message || "Erreur inconnue lors de l'envoi d'email";
        }

        results.push({
          email,
          status: "sent",
          token: pendingUser.invitation_token!,
          link: acceptUrl,
          expires_at: pendingUser.invitation_expires,
          id_utilisateur: pendingUser.id_utilisateur,
          email_delivery: emailDelivery,
          ...(lastDeliveryError ? { delivery_error: lastDeliveryError } : {}),
        });
      } catch (err: any) {
        const reason = err?.message || "Erreur inconnue";
        console.warn("[invite:team] email invitation failed", {
          email,
          roleId: membreRoleId,
          enterpriseId: inviter.id_entreprise,
          reason,
          stack: err?.stack,
        });
        // Treat known "already exists / pending" errors as soft skips so
        // the UI can render them differently from real failures.
        const isSoft =
          /existe déjà/i.test(reason) || /déjà en attente/i.test(reason);
        results.push({
          email,
          status: isSoft ? "skipped" : "error",
          reason,
          code: isSoft ? "INVITATION_NOT_CREATED_SOFT_CONFLICT" : "INVITATION_CREATE_FAILED",
        });
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const failed = results.filter((r) => r.status === "error").length;
    const emailDelivered = results.filter(
      (r) => r.status === "sent" && r.email_delivery === "sent"
    ).length;
    const emailFailed = results.filter(
      (r) => r.status === "sent" && r.email_delivery === "failed"
    ).length;
    const emailSkipped = results.filter(
      (r) => r.status === "sent" && r.email_delivery === "skipped"
    ).length;

    console.info("[invite:team] completed", {
      inviterId,
      enterpriseId: inviter.id_entreprise,
      roleId: membreRoleId,
      sent,
      skipped,
      failed,
      emailDelivered,
      emailFailed,
      emailSkipped,
    });

    let summaryMessage: string;
    if (emailDelivered > 0 && emailFailed === 0 && skipped === 0 && failed === 0) {
      summaryMessage = `${emailDelivered} invitation(s) envoyée(s) par email.`;
    } else if (emailDelivered > 0 && (emailFailed > 0 || skipped > 0 || failed > 0)) {
      summaryMessage = `${emailDelivered} invitation(s) envoyée(s) par email · ${
        emailFailed + skipped + failed
      } non remise(s).`;
    } else if (sent > 0 && emailDelivered === 0) {
      const firstFail = results.find(
        (r) =>
          r.status === "sent" &&
          r.email_delivery === "failed" &&
          typeof (r as { delivery_error?: string }).delivery_error === "string"
      ) as { delivery_error?: string } | undefined;
      const hint = firstFail?.delivery_error;
      summaryMessage =
        "Invitations créées mais aucun email n'a été livré (Brevo ou SMTP)." +
        (hint ? ` Détail : ${hint}` : "");
    } else {
      summaryMessage =
        "Aucune invitation envoyée. Consultez le détail par email ci-dessous.";
    }

    return res.status(emailDelivered > 0 ? 201 : 200).json({
      message: summaryMessage,
      role: { id_role: membreRoleId, nom: "Membre" },
      workspace: workspaceName,
      inviter: inviterDisplayName,
      email_configured: isEmailConfigured(),
      summary: {
        total: results.length,
        invitation_created: sent,
        skipped,
        failed,
        email_delivered: emailDelivered,
        email_failed: emailFailed,
        email_skipped: emailSkipped,
      },
      results,
    });
  } catch (error: any) {
    if (error?.name === "ZodError") return next(error);
    console.error("[invite:team] unhandled failure", {
      message: error?.message,
      stack: error?.stack,
      body: req.body,
      user: (req as any).user,
    });
    return res
      .status(400)
      .json({
        message: error?.message || "Erreur création invitations",
        code: "INVITATION_TEAM_REQUEST_FAILED",
      });
  }
};

export const getAllInvitations = async (req: Request, res: Response) => {
  try {
    const inviter = (req as any).user;
    const where: any = {};
    if (inviter?.role?.toString().toUpperCase() !== "SUPERADMIN" && inviter?.id_entreprise) {
      where.id_entreprise = inviter.id_entreprise;
    }
    const invitations = await prisma.invitation.findMany({ where });
    return res.json(invitations);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

export const getInvitationById = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id)
      ? parseInt(req.params.id[0])
      : parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    const invitation = await prisma.invitation.findUnique({
      where: { id_invitation: id },
    });
    if (!invitation) return res.status(404).json({ error: "Invitation non trouvée" });

    return res.json(invitation);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

export const updateInvitation = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id)
      ? parseInt(req.params.id[0])
      : parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    const { email, id_role } = req.body;
    const updatedInvitation = await prisma.invitation.update({
      where: { id_invitation: id },
      data: { email, id_role },
    });

    return res.json({ message: "Invitation mise à jour", updatedInvitation });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur mise à jour invitation" });
  }
};

export const deleteInvitation = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id)
      ? parseInt(req.params.id[0])
      : parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    await prisma.invitation.delete({ where: { id_invitation: id } });
    return res.json({ message: "Invitation supprimée" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erreur suppression invitation" });
  }
};

// Public route: lookup invitation by token (returns minimal safe payload)
export const lookupInvitationByToken = async (req: Request, res: Response) => {
  try {
    const tokenParam = req.params.token;
    const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
    if (!token) return res.status(400).json({ message: "Token requis" });

    const pendingUser: any = await findPendingInviteUserByToken(token);
    const pendingUsable = isPendingInviteUserUsable(pendingUser);
    if (pendingUser && pendingUsable.ok) {
      let inviter: { name: string; email: string | null } | null = null;
      if (pendingUser.invited_by_id) {
        try {
          const u = await prisma.utilisateur.findUnique({
            where: { id_utilisateur: pendingUser.invited_by_id },
            select: { prenom: true, nom: true, email: true },
          });
          if (u) {
            inviter = {
              name: buildInviterDisplayName(u),
              email: u.email || null,
            };
          }
        } catch (err) {
          console.warn("[lookupInvitationByToken] inviter lookup failed", err);
        }
      }
      return res.json({
        email: pendingUser.email,
        prenom: pendingUser.prenom,
        nom: pendingUser.nom,
        role: pendingUser.role?.nom || "Membre",
        entreprise: pendingUser.entreprise?.nom || null,
        expires_at: pendingUser.invitation_expires,
        inviter,
      });
    }
    if (pendingUser && !pendingUsable.ok) {
      return res.status(404).json({
        message: "Lien d'invitation invalide ou expiré.",
      });
    }

    const invitation: any = await findInvitationByToken(token);
    const usability = isInvitationUsable(invitation);
    if (!usability.ok) {
      return res.status(404).json({
        message: "Lien d'invitation invalide ou expiré.",
      });
    }

    let inviter: { name: string; email: string | null } | null = null;
    if (invitation.id_invited_by) {
      try {
        const user = await prisma.utilisateur.findUnique({
          where: { id_utilisateur: invitation.id_invited_by },
          select: { prenom: true, nom: true, email: true },
        });
        if (user) {
          inviter = {
            name: buildInviterDisplayName(user),
            email: user.email || null,
          };
        }
      } catch (err) {
        console.warn("[lookupInvitationByToken] inviter lookup failed", err);
      }
    }

    return res.json({
      email: invitation.email,
      prenom: invitation.prenom,
      nom: invitation.nom,
      role: invitation.role?.nom || null,
      entreprise: invitation.entreprise?.nom || null,
      expires_at: invitation.expires_at,
      inviter,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Erreur serveur" });
  }
};

// Public route: complete invitation acceptance with password setup
export const acceptInvitationWithToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tokenParam = req.params.token;
    const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
    const parsed = acceptInvitationByTokenSchema.parse({
      token,
      ...req.body,
    });

    const user = await acceptInvitationByToken(parsed);

    try {
      await MessagingService.addUserToAdminMeetingGroup(user.id_utilisateur);
    } catch (err) {
      console.warn(
        "[acceptInvitation] Impossible d'ajouter au groupe Réunion Admins",
        err
      );
    }

    console.info("[acceptInvitation] account activated", {
      userId: user.id_utilisateur,
      email: user.email,
      role: user.role?.nom,
      tenantId: user.id_entreprise,
    });

    return res.json({
      message: "Compte activé avec succès. Vous pouvez vous connecter.",
      user: {
        id: user.id_utilisateur,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role?.nom || null,
        id_role: user.id_role,
        id_entreprise: user.id_entreprise ?? null,
      },
    });
  } catch (error: any) {
    if (error?.name === "ZodError") return next(error);
    return res.status(400).json({
      message: error.message || "Lien d'invitation invalide ou expiré.",
    });
  }
};

// Legacy compatibility: accept by id (still public to keep existing UI working)
// but now requires password and looks up Admin role by NAME instead of id_role === 2.
export const acceptInvitation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Array.isArray(req.params.id)
      ? parseInt(req.params.id[0])
      : parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    const invitation: any = await prisma.invitation.findUnique({
      where: { id_invitation: id },
    });
    if (!invitation) {
      return res.status(404).json({ message: "Invitation non trouvée" });
    }
    if (invitation.accepted_at) {
      return res.status(400).json({ message: "Invitation déjà acceptée" });
    }
    if (invitation.expires_at && invitation.expires_at < new Date()) {
      return res.status(400).json({ message: "Invitation expirée" });
    }

    if (invitation.token) {
      return res.status(400).json({
        message:
          "Cette invitation utilise un token. Utilisez /api/invitations/accept-by-token/:token avec un mot de passe.",
      });
    }

    // Legacy path - kept for backward compatibility for invitations created before token support.
    // Look up Admin role by NAME, not by id_role === 2.
    if (invitation.id_entreprise) {
      const adminRole = await findRoleByName("Admin", invitation.id_entreprise);
      if (
        invitation.id_role &&
        adminRole &&
        invitation.id_role === adminRole.id_role
      ) {
        const existingUser = await prisma.utilisateur.findUnique({
          where: { email: invitation.email! },
          select: { id_utilisateur: true },
        });
        if (existingUser) {
          return res
            .status(400)
            .json({ message: "Un utilisateur avec cet email existe déjà" });
        }

        const user = await createUtilisateurSafe({
          email: invitation.email!,
          password: null,
          id_role: invitation.id_role,
          id_entreprise: invitation.id_entreprise ?? null,
          nom: invitation.nom || "",
          prenom: invitation.prenom || "",
          statut: "PENDING",
        });

        const entreprise = await prisma.entreprise.findUnique({
          where: { id_entreprise: invitation.id_entreprise },
        });
        if (entreprise && !entreprise.admin_id) {
          await prisma.entreprise.update({
            where: { id_entreprise: invitation.id_entreprise },
            data: { admin_id: user.id_utilisateur },
          });
        }

        await (prisma.invitation as any).update({
          where: { id_invitation: id },
          data: { accepted_at: new Date() },
        });

        try {
          await MessagingService.addUserToAdminMeetingGroup(user.id_utilisateur);
        } catch (err) {
          console.warn("[acceptInvitation legacy] addUserToAdminMeetingGroup failed", err);
        }

        return res.json({ message: "Invitation acceptée", user });
      }
    }

    return res.status(400).json({
      message:
        "Le mot de passe est requis. Utilisez /api/invitations/accept-by-token/:token.",
    });
  } catch (error: any) {
    if (error?.name === "ZodError") return next(error);
    console.error(error);
    return res.status(500).json({ error: "Erreur acceptation invitation" });
  }
};
