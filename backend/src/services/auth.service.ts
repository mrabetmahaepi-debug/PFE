import prisma from "../prisma/prismaClient";
import bcrypt from "bcrypt";
import type { RegisterInput } from "../modules/auth/auth.schema";
import { provisionTenantRoles } from "./tenantRoleProvisioning.service";
import {
  utilisateurMinimalAuthSelect,
  roleNomSelect,
  roleMeSelect,
} from "../lib/utilisateurSelect";
import { normalizeRoleForSuperAdminCompare } from "../middleware/permissions";
import { PERMISSIONS } from "../modules/permissions/permissions.catalog";
import { formatFullPhone } from "../lib/phoneCountries";
import { findEntrepriseByNormalizedName } from "../lib/entrepriseDedup";

export type { RegisterInput };

export const registerUser = async (data: RegisterInput) => {
  const email = data.email.trim().toLowerCase();
  const nom = (data.nom || "").trim() || "Administrateur";
  const prenom = (data.prenom || "").trim() || email.split("@")[0];
  const companyName = (data.entrepriseNom || "").trim();
  const companyAddress = (data.companyAddress || "").trim();
  const telephone = formatFullPhone(data.phoneCountryCode, data.phoneNumber);

  const existing = await prisma.utilisateur.findUnique({
    where: { email },
    select: { id_utilisateur: true },
  });
  if (existing) {
    throw new Error("Email déjà utilisé");
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = await prisma.$transaction(async (tx) => {
    let entreprise = companyName
      ? await findEntrepriseByNormalizedName(companyName)
      : null;

    if (!entreprise) {
      entreprise = await tx.entreprise.create({
        data: {
          nom: companyName,
          adresse: companyAddress,
          statut: "inactive",
        },
      });
    }

    const created = await tx.utilisateur.create({
      data: {
        nom,
        prenom,
        email,
        password: hashedPassword,
        telephone,
        statut: "PENDING",
        id_entreprise: entreprise.id_entreprise,
      },
      include: { role: true },
    });

    if (!entreprise.admin_id) {
      await tx.entreprise.update({
        where: { id_entreprise: entreprise.id_entreprise },
        data: { admin_id: created.id_utilisateur },
      });
    }

    return created;
  });

  try {
    await provisionTenantRoles(prisma as any, user.id_entreprise!, {
      enterpriseName: companyName,
    });
  } catch (err) {
    console.error("[registerUser] provisionTenantRoles failed (non-fatal):", err);
  }

  const superAdmins = await prisma.utilisateur.findMany({
    where: { role: { nom: "SuperAdmin" } },
    select: { id_utilisateur: true },
  });

  for (const admin of superAdmins) {
    await prisma.notification.create({
      data: {
        sujet: "Nouvelle demande d'inscription",
        message: `${prenom} ${nom} demande l'approbation pour l'entreprise « ${companyName} » (${email}).`,
        type: "warning",
        id_utilisateur: admin.id_utilisateur,
        date_envoi: new Date(),
        metadata: JSON.stringify({
          action: "approve_user",
          userId: user.id_utilisateur,
        }),
      },
    });
  }

  return user;
};

export class AuthError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 401, code = "AUTH_INVALID") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function findUtilisateurForLogin(email: string) {
  return prisma.utilisateur.findUnique({
    where: { email },
    select: utilisateurMinimalAuthSelect,
  });
}

export const loginUser = async (email: string, password: string) => {
  const trimmedEmail = (email || "").trim().toLowerCase();
  const user = await findUtilisateurForLogin(trimmedEmail);

  // 1) User not found OR has no password set yet (e.g. invitation never accepted)
  if (!user) {
    console.warn(`[auth] login failed: user not found for "${trimmedEmail}"`);
    throw new AuthError("Identifiants invalides", 401, "AUTH_INVALID");
  }
  if (!user.password) {
    if (user.statut === "INVITATION_PENDING") {
      throw new AuthError(
        "Activez votre compte via le lien d'invitation reçu par email.",
        403,
        "AUTH_INVITATION_PENDING"
      );
    }
    console.warn(
      `[auth] login failed: user ${trimmedEmail} has no password (invitation never accepted?)`
    );
    throw new AuthError("Identifiants invalides", 401, "AUTH_INVALID");
  }

  // 2) Verify password BEFORE leaking status info
  //    (avoids account-status enumeration on wrong password)
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    console.warn(
      `[auth] login failed: bad password for ${trimmedEmail} (role=${user.role?.nom ?? "?"}, statut=${user.statut})`
    );
    throw new AuthError("Identifiants invalides", 401, "AUTH_INVALID");
  }

  // 3) Password OK – now check account status (legacy rows may have null statut → treat as ACTIVE)
  const statut = user.statut == null || user.statut === "" ? "ACTIVE" : user.statut;

  if (statut === "INVITATION_PENDING") {
    throw new AuthError(
      "Activez votre compte via le lien d'invitation reçu par email.",
      403,
      "AUTH_INVITATION_PENDING"
    );
  }

  if (statut === "REJECTED") {
    throw new AuthError(
      "Votre demande d'inscription a été refusée par l'administrateur.",
      403,
      "AUTH_REJECTED"
    );
  }

  if (statut === "PENDING") {
    throw new AuthError(
      "Votre compte est en attente de validation par l'administrateur.",
      403,
      "AUTH_PENDING"
    );
  }

  if (statut !== "ACTIVE") {
    throw new AuthError(
      "Votre compte n'est pas actif. Contactez un administrateur.",
      403,
      "AUTH_INACTIVE"
    );
  }

  // 4) Update last login + presence (non-blocking; DB may not have presence columns yet)
  const now = new Date();
  try {
    await prisma.utilisateur.update({
      where: { id_utilisateur: user.id_utilisateur },
      data: {
        lastLogin: now,
        lastSeen: now,
        isOnline: true,
      },
    });
  } catch (err) {
    console.warn("[auth] presence update on login failed, retrying lastLogin only:", err);
    try {
      await prisma.utilisateur.update({
        where: { id_utilisateur: user.id_utilisateur },
        data: { lastLogin: now },
      });
    } catch (err2) {
      console.warn("[auth] lastLogin update failed (login still succeeds):", err2);
    }
  }

  return user;
};

/** Mark user offline (explicit logout). Never throws — optional presence columns. */
export const markUserOffline = async (userId: number) => {
  try {
    await prisma.utilisateur.update({
      where: { id_utilisateur: userId },
      data: {
        isOnline: false,
        lastSeen: new Date(),
      },
    });
  } catch (err) {
    console.warn("[auth] markUserOffline failed (ignored):", err);
  }
};

function mapUtilisateurToMePayload(user: any): {
  id: number;
  id_utilisateur: number;
  nom: string | null;
  prenom: string | null;
  email: string | null;
  id_role: number | null;
  id_entreprise: number | null;
  photoUrl?: string;
  role: string | undefined;
  /** Aligné sur le middleware JWT : le client peut s’y fier si le libellé de rôle varie. */
  isSuperAdmin: boolean;
  permissions: string[];
} {
  const roleNom = user.role?.nom || "";
  const isSuperAdminUser =
    normalizeRoleForSuperAdminCompare(roleNom) === "SUPERADMIN";
  const permsFromRole =
    user.role?.permission && Array.isArray(user.role.permission)
      ? user.role.permission.map((p: { nom: string }) => p.nom).filter(Boolean)
      : [];
  const permissions = isSuperAdminUser
    ? PERMISSIONS.map((p) => p.name)
    : permsFromRole;
  return {
    id: user.id_utilisateur,
    id_utilisateur: user.id_utilisateur,
    nom: user.nom,
    prenom: user.prenom,
    email: user.email,
    id_role: user.id_role,
    id_entreprise: user.id_entreprise,
    photoUrl: user.photoUrl ?? undefined,
    role: roleNom || undefined,
    isSuperAdmin: isSuperAdminUser,
    permissions,
  };
}

/**
 * Load current user for GET /auth/me — tolerant of missing optional DB columns.
 * Does not run project-level permission logic.
 */
export const getMe = async (userId: number) => {
  const attempts: { label: string; select: Record<string, unknown> }[] = [
    {
      label: "full+perms+presence",
      select: {
        id_utilisateur: true,
        nom: true,
        prenom: true,
        email: true,
        id_role: true,
        id_entreprise: true,
        photoUrl: true,
        lastLogin: true,
        isOnline: true,
        lastSeen: true,
        role: { select: roleMeSelect },
      },
    },
    {
      label: "full+perms",
      select: {
        id_utilisateur: true,
        nom: true,
        prenom: true,
        email: true,
        id_role: true,
        id_entreprise: true,
        photoUrl: true,
        lastLogin: true,
        role: { select: roleMeSelect },
      },
    },
    {
      label: "core+perms",
      select: {
        id_utilisateur: true,
        nom: true,
        prenom: true,
        email: true,
        id_role: true,
        id_entreprise: true,
        lastLogin: true,
        role: { select: roleMeSelect },
      },
    },
    {
      label: "minimal+perms",
      select: {
        id_utilisateur: true,
        nom: true,
        prenom: true,
        email: true,
        id_role: true,
        id_entreprise: true,
        role: { select: roleMeSelect },
      },
    },
    {
      label: "minimal+roleName",
      select: {
        id_utilisateur: true,
        nom: true,
        prenom: true,
        email: true,
        id_role: true,
        id_entreprise: true,
        role: { select: roleNomSelect },
      },
    },
  ];

  let user: any = null;

  for (const a of attempts) {
    try {
      const row = await prisma.utilisateur.findUnique({
        where: { id_utilisateur: userId },
        select: a.select as any,
      });
      if (row) {
        user = row;
        break;
      }
      // Prisma returned null → no row for this id
      break;
    } catch (err) {
      console.warn(`[auth] getMe select "${a.label}" failed, trying next:`, err);
    }
  }

  if (!user) {
    throw new Error("Utilisateur non trouvé");
  }

  return mapUtilisateurToMePayload(user);
};
