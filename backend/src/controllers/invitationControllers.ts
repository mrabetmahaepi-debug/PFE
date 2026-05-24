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
  setUserInvitationEmailStatus,
  setInvitationRowEmailStatus,
  type InvitationEmailStatus,
} from "../services/invitation.service";
import {
  sendEmail,
  isEmailConfigured,
  getEmailProviderInfo,
  getEmailTransportLogContext,
} from "../services/email.service";
import { buildInvitationEmail } from "../services/emailTemplates/invitationEmail";
import { createUtilisateurSafe } from "../lib/createUtilisateurSafe";
import { resolveProjectPosteLabel } from "../lib/projectRoleLabels";
import { listInvitationProjectsForUser } from "../lib/invitationProjectAccess";

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
  return `${base}/invitations/accept/${encodeURIComponent(token)}`;
};

const memberSafeError = (raw: string): string => {
  const lower = raw.toLowerCase();
  if (lower.includes("expir")) {
    return "Cette invitation a expiré. Demandez un nouvel envoi à votre administrateur.";
  }
  if (lower.includes("déjà accept") || lower.includes("deja accept")) {
    return "Cette invitation a déjà été utilisée. Connectez-vous ou réinitialisez votre mot de passe.";
  }
  if (lower.includes("mot de passe") || lower.includes("correspondent pas")) {
    return raw;
  }
  if (lower.includes("token") || lower.includes("introuvable") || lower.includes("invalide")) {
    return "Lien d'invitation invalide ou expiré.";
  }
  return "Impossible de finaliser l'invitation. Vérifiez le lien ou contactez votre administrateur.";
};

type InvitationEmailAttempt = {
  emailStatus: InvitationEmailStatus;
  delivery_error?: string;
  messageId?: string;
  mode?: string;
  httpStatus?: number;
  brevoResponse?: unknown;
};

async function attemptInvitationEmail(params: {
  to: string;
  workspaceName: string;
  inviterDisplayName: string;
  inviterEmail?: string | null;
  roleName: string;
  acceptUrl: string;
  expiresAt: Date | null;
}): Promise<InvitationEmailAttempt> {
  const transportLog = getEmailTransportLogContext();

  if (!isEmailConfigured()) {
    const msg =
      "Fournisseur email non configuré (BREVO_API_KEY / EMAIL_FROM ou SMTP).";
    console.warn("[invite:email] skipped — provider not configured", {
      to: params.to,
      acceptUrl: params.acceptUrl,
      transport: transportLog,
    });
    return { emailStatus: "pending", delivery_error: msg, mode: "none" };
  }

  try {
    const built = buildInvitationEmail({
      workspaceName: params.workspaceName,
      inviterName: params.inviterDisplayName,
      inviterEmail: params.inviterEmail ?? undefined,
      roleName: params.roleName,
      acceptUrl: params.acceptUrl,
      expiresAt: params.expiresAt,
      appName: process.env.APP_NAME || "GestionPro",
    });

    const provider = getEmailProviderInfo().provider;

    console.log({
      provider,
      from: transportLog.from,
      to: params.to,
      subject: built.subject,
    });

    console.info("[invite:email] before send", {
      to: params.to,
      workspaceName: params.workspaceName,
      roleName: params.roleName,
      acceptUrl: params.acceptUrl,
      expiresAt: params.expiresAt?.toISOString?.() ?? params.expiresAt,
      inviter: params.inviterDisplayName,
      inviterEmail: params.inviterEmail ?? null,
      transport: transportLog,
    });

    const sendResult = await sendEmail({
      to: params.to,
      subject: built.subject,
      html: built.html,
      text: built.text,
      replyTo: params.inviterEmail || undefined,
    });

    if (sendResult.delivered) {
      console.info("[invite:email] after Brevo send success", {
        to: params.to,
        mode: sendResult.mode,
        messageId: sendResult.messageId,
        httpStatus: sendResult.httpStatus,
        brevoResponse: sendResult.brevoResponse,
      });
      return {
        emailStatus: "sent",
        messageId: sendResult.messageId,
        mode: sendResult.mode,
        httpStatus: sendResult.httpStatus,
        brevoResponse: sendResult.brevoResponse,
      };
    }

    const errMsg =
      sendResult.error ||
      "Erreur d'envoi email (aucun détail rapporté par le transport).";
    console.error("[invite:email] Brevo/email delivery failed", {
      to: params.to,
      mode: sendResult.mode,
      error: errMsg,
      httpStatus: sendResult.httpStatus,
      brevoResponse: sendResult.brevoResponse,
      transport: transportLog,
    });
    const deliveryDetail =
      sendResult.brevoResponse != null
        ? `${errMsg} — Brevo: ${JSON.stringify(sendResult.brevoResponse)}`
        : errMsg;
    return {
      emailStatus: "failed",
      delivery_error: deliveryDetail,
      mode: sendResult.mode,
      httpStatus: sendResult.httpStatus,
      brevoResponse: sendResult.brevoResponse,
    };
  } catch (mailErr: unknown) {
    const e = mailErr as {
      message?: string;
      status?: number;
      code?: string;
      response?: {
        body?: unknown;
        data?: unknown;
        text?: string;
        status?: number;
      };
    };
    console.error("BREVO SEND ERROR:", {
      message: e?.message ?? (mailErr instanceof Error ? mailErr.message : String(mailErr)),
      status: e?.status ?? e?.response?.status,
      body: e?.response?.body,
      data: e?.response?.data,
      text: e?.response?.text,
    });
    throw mailErr;
  }
}

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

    const acceptUrl = buildInvitationLink(invitation.token!);
    const [inviterRecord, enterprise, roleRow] = await Promise.all([
      inviter?.id
        ? prisma.utilisateur.findUnique({
            where: { id_utilisateur: Number(inviter.id) },
            select: { prenom: true, nom: true, email: true },
          })
        : Promise.resolve(null),
      invitation.id_entreprise
        ? prisma.entreprise.findUnique({
            where: { id_entreprise: invitation.id_entreprise },
            select: { nom: true },
          })
        : Promise.resolve(null),
      invitation.id_role
        ? prisma.role.findUnique({
            where: { id_role: invitation.id_role },
            select: { nom: true },
          })
        : Promise.resolve(null),
    ]);

    const delivery = await attemptInvitationEmail({
      to: invitation.email!,
      workspaceName: enterprise?.nom || "votre espace de travail",
      inviterDisplayName: buildInviterDisplayName(inviterRecord),
      inviterEmail: inviterRecord?.email,
      roleName: roleRow?.nom || "Membre",
      acceptUrl,
      expiresAt: invitation.expires_at,
    });

    await setInvitationRowEmailStatus(
      invitation.id_invitation,
      delivery.emailStatus
    );

    const link = acceptUrl;
    const warning =
      delivery.emailStatus !== "sent"
        ? "Invitation créée, mais l'email n'a pas pu être envoyé."
        : undefined;

    return res.status(201).json({
      message: warning || "Invitation créée et email envoyé.",
      warning,
      invitation: {
        id_invitation: invitation.id_invitation,
        email: invitation.email,
        token: invitation.token,
        link,
        expires_at: invitation.expires_at,
        id_role: invitation.id_role,
        id_entreprise: invitation.id_entreprise,
        emailStatus: delivery.emailStatus,
      },
      ...(delivery.delivery_error ? { delivery_error: delivery.delivery_error } : {}),
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
  console.info("[invite:team] invitation request started", {
    path: req.path,
    method: req.method,
    bodyEmails: Array.isArray(req.body?.emails) ? req.body.emails : null,
    poste: req.body?.poste,
    projectIds: req.body?.project_ids,
    expiresAt: req.body?.expires_at,
  });

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

    // Invitations are always persisted first; email delivery is attempted
    // afterward and failures are surfaced with a copyable link for admins.
    if (!isEmailConfigured()) {
      console.warn(
        "[invite:team] email provider not configured — invitations will be created with emailStatus=pending",
        getEmailProviderInfo()
      );
    } else {
      console.info("[invite:team] email provider diagnostics", getEmailProviderInfo());
    }

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
      roleName: parsed.poste,
      requestedEmails: parsed.emails.length,
      uniqueEmails: uniqueEmails.length,
      smtpConfigured: isEmailConfigured(),
    });

    const results: Array<
      | {
          email: string;
          status: "created";
          token: string;
          link: string;
          expires_at: Date | null;
          id_utilisateur: number;
          emailStatus: InvitationEmailStatus;
          /** @deprecated use emailStatus */
          email_delivery: "sent" | "skipped" | "failed";
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
          poste: parsed.poste,
          id_invited_by: inviterId,
          project_ids: parsed.project_ids,
          expires_at: parsed.expires_at,
        });

        const acceptUrl = buildInvitationLink(pendingUser.invitation_token!);

        console.info("[invite:team] before sending invitation email", {
          email,
          acceptUrl,
          poste: parsed.poste,
          expiresAt: pendingUser.invitation_expires,
          id_utilisateur: pendingUser.id_utilisateur,
        });

        const delivery = await attemptInvitationEmail({
          to: email,
          workspaceName,
          inviterDisplayName,
          inviterEmail: inviterRecord?.email,
          roleName: parsed.poste,
          acceptUrl,
          expiresAt: pendingUser.invitation_expires,
        });

        if (delivery.emailStatus === "sent") {
          console.info("[invite:team] invitation email sent", {
            email,
            messageId: delivery.messageId,
            httpStatus: delivery.httpStatus,
          });
        } else {
          console.error("[invite:team] invitation email not sent", {
            email,
            emailStatus: delivery.emailStatus,
            delivery_error: delivery.delivery_error,
            httpStatus: delivery.httpStatus,
            brevoResponse: delivery.brevoResponse,
          });
        }

        await setUserInvitationEmailStatus(
          pendingUser.id_utilisateur,
          delivery.emailStatus
        );

        const emailDeliveryLegacy =
          delivery.emailStatus === "sent"
            ? "sent"
            : delivery.emailStatus === "failed"
              ? "failed"
              : "skipped";

        results.push({
          email,
          status: "created",
          token: pendingUser.invitation_token!,
          link: acceptUrl,
          expires_at: pendingUser.invitation_expires,
          id_utilisateur: pendingUser.id_utilisateur,
          emailStatus: delivery.emailStatus,
          email_delivery: emailDeliveryLegacy,
          ...(delivery.delivery_error
            ? { delivery_error: delivery.delivery_error }
            : {}),
          ...(delivery.httpStatus != null
            ? { httpStatus: delivery.httpStatus }
            : {}),
          ...(delivery.brevoResponse != null
            ? { brevoResponse: delivery.brevoResponse }
            : {}),
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

    const created = results.filter((r) => r.status === "created").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const failed = results.filter((r) => r.status === "error").length;
    const emailDelivered = results.filter(
      (r) => r.status === "created" && r.emailStatus === "sent"
    ).length;
    const emailFailed = results.filter(
      (r) => r.status === "created" && r.emailStatus === "failed"
    ).length;
    const emailPending = results.filter(
      (r) => r.status === "created" && r.emailStatus === "pending"
    ).length;

    console.info("[invite:team] completed", {
      inviterId,
      enterpriseId: inviter.id_entreprise,
      roleId: membreRoleId,
      created,
      skipped,
      failed,
      emailDelivered,
      emailFailed,
      emailPending,
    });

    let summaryMessage: string;
    let warning: string | undefined;
    if (
      emailDelivered > 0 &&
      emailFailed === 0 &&
      emailPending === 0 &&
      skipped === 0 &&
      failed === 0
    ) {
      summaryMessage = `${emailDelivered} invitation(s) envoyée(s) par email.`;
    } else if (created > 0 && emailDelivered === 0) {
      warning = "Invitation créée, mais l'email n'a pas pu être envoyé.";
      summaryMessage =
        created === 1
          ? warning
          : `${created} invitation(s) créée(s), mais aucun email n'a pu être envoyé.`;
    } else if (emailDelivered > 0) {
      summaryMessage = `${emailDelivered} invitation(s) envoyée(s) par email · ${
        emailFailed + emailPending + skipped + failed
      } avec avertissement.`;
      if (emailFailed > 0 || emailPending > 0) {
        warning =
          "Invitation créée, mais l'email n'a pas pu être envoyé pour certaines adresses.";
      }
    } else {
      summaryMessage =
        "Aucune invitation envoyée. Consultez le détail par email ci-dessous.";
    }

    return res.status(emailDelivered > 0 ? 201 : 200).json({
      message: summaryMessage,
      warning,
      role: { id_role: membreRoleId, nom: "Membre" },
      workspace: workspaceName,
      inviter: inviterDisplayName,
      email_configured: isEmailConfigured(),
      summary: {
        total: results.length,
        invitation_created: created,
        skipped,
        failed,
        email_delivered: emailDelivered,
        email_failed: emailFailed,
        email_pending: emailPending,
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
      const invitePoste =
        pendingUser.poste?.trim() || pendingUser.role?.nom || "Membre";
      const projects = await listInvitationProjectsForUser(
        pendingUser.id_utilisateur
      );
      return res.json({
        email: pendingUser.email,
        prenom: pendingUser.prenom,
        nom: pendingUser.nom,
        role: invitePoste,
        poste: invitePoste,
        profile: invitePoste,
        entreprise: pendingUser.entreprise?.nom || null,
        expires_at: pendingUser.invitation_expires,
        projects: projects.map((p) => ({
          id_projet: p.id_projet,
          nom: p.nom,
        })),
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
      poste: user.poste,
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
        poste: user.poste ? resolveProjectPosteLabel(user.poste) : null,
        id_role: user.id_role,
        id_entreprise: user.id_entreprise ?? null,
      },
    });
  } catch (error: any) {
    if (error?.name === "ZodError") return next(error);
    return res.status(400).json({
      message: memberSafeError(error.message || "Lien d'invitation invalide ou expiré."),
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
