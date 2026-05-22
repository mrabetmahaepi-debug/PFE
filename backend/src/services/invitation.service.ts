import crypto from "crypto";
import bcrypt from "bcrypt";
import prisma from "../prisma/prismaClient";
import { createUtilisateurSafe } from "../lib/createUtilisateurSafe";

const INVITATION_TTL_DAYS = 7;

const ADMIN_ROLE_NAMES = ["Admin", "ADMIN", "admin"];

export const generateInvitationToken = () => {
  return crypto.randomBytes(48).toString("hex");
};

export const findRoleByName = async (name: string, idEntreprise?: number | null) => {
  if (idEntreprise) {
    const scoped = await prisma.role.findFirst({
      where: {
        nom: { in: [name, name.toLowerCase(), name.toUpperCase()] },
        id_entreprise: idEntreprise,
      },
    });
    if (scoped) return scoped;
  }
  return prisma.role.findFirst({
    where: { nom: { in: [name, name.toLowerCase(), name.toUpperCase()] } },
  });
};

const isAdminRoleId = async (id_role: number | null | undefined) => {
  if (!id_role) return false;
  const role = await prisma.role.findUnique({ where: { id_role } });
  if (!role?.nom) return false;
  return ADMIN_ROLE_NAMES.includes(role.nom);
};

export interface CreateInvitationData {
  email: string;
  id_role: number;
  id_entreprise?: number | null;
  prenom?: string;
  nom?: string;
  id_invited_by?: number | null;
}

/** Super-admin / legacy flow: invitation row only (user created on accept). */
export const createInvitation = async (data: CreateInvitationData) => {
  const email = data.email.trim().toLowerCase();
  const now = new Date();

  const existingUser = await prisma.utilisateur.findUnique({
    where: { email },
    select: { id_utilisateur: true, statut: true, password: true },
  });
  if (existingUser) {
    if (existingUser.statut === "INVITATION_PENDING") {
      throw new Error(
        "Une invitation équipe est déjà en cours pour cet email (compte en attente d'activation)."
      );
    }
    if (existingUser.statut === "ACTIVE" || existingUser.password) {
      throw new Error("Un utilisateur avec cet email existe déjà");
    }
  }

  const pendingInvitation = await prisma.invitation.findFirst({
    where: {
      email,
      accepted_at: null,
      id_entreprise: data.id_entreprise ?? null,
    },
    orderBy: { createdAt: "desc" },
  });
  if (
    pendingInvitation &&
    (!pendingInvitation.expires_at || pendingInvitation.expires_at > now)
  ) {
    throw new Error("Une invitation est déjà en attente pour cet email");
  }

  const token = generateInvitationToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  if (pendingInvitation) {
    return prisma.invitation.update({
      where: { id_invitation: pendingInvitation.id_invitation },
      data: {
        id_role: data.id_role,
        id_entreprise: data.id_entreprise ?? null,
        prenom: data.prenom?.trim() || null,
        nom: data.nom?.trim() || null,
        token,
        expires_at: expiresAt,
        id_invited_by: data.id_invited_by ?? null,
        createdAt: now,
      },
    });
  }

  return prisma.invitation.create({
    data: {
      email,
      id_role: data.id_role,
      id_entreprise: data.id_entreprise ?? null,
      prenom: data.prenom?.trim() || null,
      nom: data.nom?.trim() || null,
      token,
      expires_at: expiresAt,
      id_invited_by: data.id_invited_by ?? null,
    },
  });
};

export interface CreateTeamMemberPendingInviteInput {
  email: string;
  id_role: number;
  id_entreprise: number;
  prenom?: string | null;
  nom?: string | null;
  id_invited_by: number;
}

/**
 * Tenant team invite: create (or refresh) a utilisateur row in INVITATION_PENDING
 * with no password until the invitee accepts via token.
 */
export const createTeamMemberPendingInvite = async (
  data: CreateTeamMemberPendingInviteInput
) => {
  const email = data.email.trim().toLowerCase();
  const now = new Date();
  const token = generateInvitationToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const prenom =
    (data.prenom && data.prenom.trim()) || email.split("@")[0] || "Invité";
  const nom = (data.nom && data.nom.trim()) || "—";

  const existing = await prisma.utilisateur.findUnique({
    where: { email },
    select: {
      id_utilisateur: true,
      statut: true,
      password: true,
      invitation_token: true,
    },
  });

  if (existing) {
    if (existing.statut === "ACTIVE" && existing.password) {
      throw new Error("Un utilisateur avec cet email existe déjà");
    }
    if (existing.statut === "INVITATION_PENDING") {
      await prisma.invitation.deleteMany({
        where: { email, id_entreprise: data.id_entreprise, accepted_at: null },
      });
      return prisma.utilisateur.update({
        where: { id_utilisateur: existing.id_utilisateur },
        data: {
          invitation_token: token,
          invitation_expires: expiresAt,
          invited_by_id: data.id_invited_by,
          id_role: data.id_role,
          id_entreprise: data.id_entreprise,
          prenom,
          nom,
          password: null,
          statut: "INVITATION_PENDING",
        },
        include: { role: true },
      });
    }
    if (existing.statut === "PENDING" && !existing.password) {
      throw new Error(
        "Une demande d'inscription est déjà en cours pour cet email"
      );
    }
    throw new Error("Un utilisateur avec cet email existe déjà");
  }

  await prisma.invitation.deleteMany({
    where: { email, id_entreprise: data.id_entreprise, accepted_at: null },
  });

  return prisma.utilisateur.create({
    data: {
      email,
      prenom,
      nom,
      id_role: data.id_role,
      id_entreprise: data.id_entreprise,
      password: null,
      statut: "INVITATION_PENDING",
      invitation_token: token,
      invitation_expires: expiresAt,
      invited_by_id: data.id_invited_by,
    },
    include: { role: true },
  });
};

export const findInvitationByToken = async (token: string) => {
  return prisma.invitation.findUnique({
    where: { token },
    include: {
      role: true,
      entreprise: true,
    },
  });
};

export const findPendingInviteUserByToken = async (token: string) => {
  return prisma.utilisateur.findFirst({
    where: { invitation_token: token },
    include: {
      role: true,
      entreprise: true,
      invitedBy: {
        select: { prenom: true, nom: true, email: true },
      },
    },
  });
};

export const isInvitationUsable = (invitation: any) => {
  if (!invitation) return { ok: false, reason: "Invitation introuvable" };
  if (invitation.accepted_at)
    return { ok: false, reason: "Invitation déjà acceptée" };
  if (invitation.expires_at && invitation.expires_at < new Date())
    return { ok: false, reason: "Invitation expirée" };
  return { ok: true as const };
};

export const isPendingInviteUserUsable = (user: any) => {
  if (!user) return { ok: false, reason: "Invitation introuvable" };
  if (user.statut !== "INVITATION_PENDING")
    return { ok: false, reason: "Invitation introuvable" };
  if (user.password)
    return { ok: false, reason: "Invitation déjà acceptée" };
  if (user.invitation_expires && user.invitation_expires < new Date())
    return { ok: false, reason: "Invitation expirée" };
  return { ok: true as const };
};

export interface AcceptInvitationData {
  token: string;
  password: string;
  prenom: string;
  nom: string;
}

export const acceptInvitationByToken = async (data: AcceptInvitationData) => {
  const pendingUser = await findPendingInviteUserByToken(data.token);
  const pendingOk = isPendingInviteUserUsable(pendingUser);
  if (pendingOk.ok && pendingUser) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const upd = await prisma.utilisateur.updateMany({
      where: {
        id_utilisateur: pendingUser.id_utilisateur,
        invitation_token: data.token,
        statut: "INVITATION_PENDING",
      },
      data: {
        password: hashedPassword,
        prenom: data.prenom,
        nom: data.nom,
        statut: "ACTIVE",
        invitation_token: null,
        invitation_expires: null,
      },
    });
    if (upd.count !== 1) {
      throw new Error("Invitation déjà acceptée ou invalide");
    }
    const updated = await prisma.utilisateur.findUniqueOrThrow({
      where: { id_utilisateur: pendingUser.id_utilisateur },
      include: { role: true },
    });
    await prisma.invitation.deleteMany({
      where: { email: updated.email!, accepted_at: null },
    });
    return updated;
  }

  const invitation = await findInvitationByToken(data.token);
  const usability = isInvitationUsable(invitation);
  if (!usability.ok) {
    throw new Error(usability.reason);
  }

  const existingUser = await prisma.utilisateur.findUnique({
    where: { email: invitation!.email! },
    select: { id_utilisateur: true },
  });
  if (existingUser) {
    throw new Error("Un utilisateur avec cet email existe déjà");
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = await createUtilisateurSafe({
    email: invitation!.email!,
    password: hashedPassword,
    id_role: invitation!.id_role!,
    id_entreprise: invitation!.id_entreprise ?? null,
    nom: data.nom,
    prenom: data.prenom,
    statut: "ACTIVE",
  });

  if (invitation!.id_entreprise && (await isAdminRoleId(invitation!.id_role))) {
    const entreprise = await prisma.entreprise.findUnique({
      where: { id_entreprise: invitation!.id_entreprise },
    });
    if (entreprise && !entreprise.admin_id) {
      await prisma.entreprise.update({
        where: { id_entreprise: invitation!.id_entreprise },
        data: { admin_id: user.id_utilisateur },
      });
    }
  }

  await prisma.invitation.update({
    where: { id_invitation: invitation!.id_invitation },
    data: { accepted_at: new Date() },
  });

  return user;
};
