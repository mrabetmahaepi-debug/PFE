import crypto from "crypto";
import bcrypt from "bcrypt";
import prisma from "../prisma/prismaClient";
import { createUtilisateurSafe } from "../lib/createUtilisateurSafe";
import { provisionDefaultRolePermissions } from "./defaultRoleAccess.service";
import { resolveProjectPosteLabel } from "../lib/projectRoleLabels";
import { logRoleAssignment } from "../lib/roleAssignmentLog";
import { syncInvitationProjectAccess } from "../lib/invitationProjectAccess";

const INVITATION_TTL_DAYS = 7;

export function resolveInvitationExpiresAt(expiresAt?: Date | null): Date {
  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > Date.now()) {
    return expiresAt;
  }
  return new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export type InvitationEmailStatus = "pending" | "sent" | "failed";

export async function setUserInvitationEmailStatus(
  userId: number,
  status: InvitationEmailStatus
): Promise<void> {
  await prisma.utilisateur.update({
    where: { id_utilisateur: userId },
    data: { invitation_email_status: status },
  });
}

export async function setInvitationRowEmailStatus(
  invitationId: number,
  status: InvitationEmailStatus
): Promise<void> {
  await prisma.invitation.update({
    where: { id_invitation: invitationId },
    data: { email_status: status },
  });
}

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
        email_status: "pending",
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
      email_status: "pending",
    },
  });
};

export interface CreateTeamMemberPendingInviteInput {
  email: string;
  id_role: number;
  id_entreprise: number;
  prenom: string;
  nom: string;
  poste: string;
  id_invited_by: number;
  project_ids: number[];
  expires_at?: Date | null;
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
  const expiresAt = resolveInvitationExpiresAt(data.expires_at ?? null);

  const prenom = data.prenom.trim() || email.split("@")[0] || "Invité";
  const nom = data.nom.trim() || "—";
  const poste = resolveProjectPosteLabel(data.poste);

  const afterProjectSync = async (userId: number) => {
    await syncInvitationProjectAccess({
      userId,
      enterpriseId: data.id_entreprise,
      projectIds: data.project_ids,
      poste,
      grantedById: data.id_invited_by,
      invitationPending: true,
    });
  };

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
          invitation_email_status: "pending",
          invited_by_id: data.id_invited_by,
          id_role: data.id_role,
          id_entreprise: data.id_entreprise,
          prenom,
          nom,
          poste,
          password: null,
          statut: "INVITATION_PENDING",
        },
        include: { role: true },
      }).then(async (updated) => {
      await provisionDefaultRolePermissions({
        userId: updated.id_utilisateur,
        enterpriseId: data.id_entreprise,
        poste,
        grantedById: data.id_invited_by,
      });
      await afterProjectSync(updated.id_utilisateur);
      logRoleAssignment("createTeamMemberPendingInvite:refresh", {
        selectedRole: data.poste,
        savedRole: poste,
        loadedRole: updated.poste ?? poste,
        globalRoleNom: updated.role?.nom ?? null,
        poste: updated.poste ?? poste,
        userId: updated.id_utilisateur,
        email: updated.email,
      });
      return updated;
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

  const created = await prisma.utilisateur.create({
    data: {
      email,
      prenom,
      nom,
      poste,
      id_role: data.id_role,
      id_entreprise: data.id_entreprise,
      password: null,
      statut: "INVITATION_PENDING",
      invitation_token: token,
      invitation_expires: expiresAt,
      invitation_email_status: "pending",
      invited_by_id: data.id_invited_by,
    },
    include: { role: true },
  });

  await provisionDefaultRolePermissions({
    userId: created.id_utilisateur,
    enterpriseId: data.id_entreprise,
    poste,
    grantedById: data.id_invited_by,
  });
  await afterProjectSync(created.id_utilisateur);

  logRoleAssignment("createTeamMemberPendingInvite", {
    selectedRole: data.poste,
    savedRole: poste,
    loadedRole: created.poste ?? poste,
    globalRoleNom: created.role?.nom ?? null,
    poste: created.poste ?? poste,
    userId: created.id_utilisateur,
    email: created.email,
  });

  return created;
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
    if (updated.id_entreprise) {
      await provisionDefaultRolePermissions({
        userId: updated.id_utilisateur,
        enterpriseId: updated.id_entreprise,
        poste: updated.poste,
      });
    }
    logRoleAssignment("acceptInvitationByToken", {
      selectedRole: pendingUser.poste ?? null,
      savedRole: updated.poste ?? pendingUser.poste ?? null,
      loadedRole: updated.poste ?? null,
      globalRoleNom: updated.role?.nom ?? null,
      poste: updated.poste ?? null,
      userId: updated.id_utilisateur,
      email: updated.email,
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

  if (user.id_entreprise) {
    await provisionDefaultRolePermissions({
      userId: user.id_utilisateur,
      enterpriseId: user.id_entreprise,
      poste: user.poste,
    });
  }

  return user;
};
