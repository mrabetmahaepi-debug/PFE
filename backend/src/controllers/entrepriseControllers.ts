import { Request, Response, NextFunction } from "express";
import prisma from "../prisma/prismaClient";
import { successResponse, errorResponse } from "../utils/response";
import { Prisma } from "@prisma/client";
import { paginate, paginatedResponse } from "../middleware/validate";
import { hashPassword } from "../utils/hash";
import { MessagingService } from "../services/messaging.service";
import { provisionTenantRoles } from "../services/tenantRoleProvisioning.service";
import { computePresenceOnline } from "../lib/presence";
import { formatFullPhone, parseStoredPhoneFields } from "../lib/phoneCountries";
import {
  buildMergedEnterpriseList,
  consolidateDuplicateEnterprisesByName,
  findEntrepriseByNormalizedName,
  getEnterpriseAdminsByCompanyId,
  resolveCanonicalEnterpriseId,
} from "../lib/entrepriseDedup";

type AdminSelectRow = {
  id_utilisateur: number;
  nom: string | null;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  createdAt?: Date | string | null;
  isOnline: boolean;
  lastSeen: Date | null;
};

function mapAdminPayload(admin: AdminSelectRow | null) {
  if (!admin) return null;
  const phoneFields = parseStoredPhoneFields(admin.telephone);
  return {
    ...admin,
    ...phoneFields,
    phone: phoneFields.phone ?? admin.telephone,
    isOnline: computePresenceOnline(!!admin.isOnline, admin.lastSeen ?? null),
  };
}

function mapEntreprisePayload<T extends { telephone?: string | null; admin?: AdminSelectRow | null }>(
  entreprise: T,
  phoneOverride?: {
    phoneCountryCode?: string;
    phoneNumber?: string;
    telephone?: string | null;
  }
) {
  const telephone =
    phoneOverride?.telephone !== undefined
      ? phoneOverride.telephone
      : entreprise.telephone ?? null;

  let phoneFields = parseStoredPhoneFields(telephone);
  if (phoneOverride?.phoneCountryCode && phoneOverride?.phoneNumber) {
    const national = phoneOverride.phoneNumber.replace(/\D/g, "");
    if (national.length) {
      const formatted = formatFullPhone(phoneOverride.phoneCountryCode, national);
      phoneFields = {
        phone: formatted,
        telephone: formatted,
        phoneCountryCode: phoneOverride.phoneCountryCode,
        phoneNumber: national,
      };
    }
  }

  const admin = mapAdminPayload(entreprise.admin ?? null);

  return {
    ...entreprise,
    ...phoneFields,
    telephone: phoneFields.telephone,
    admin,
    responsibleAdmin: admin,
  };
}

// --- Créer entreprise ---
export const createEntreprise = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nom, adresse } = req.body;
    const trimmedNom = String(nom ?? "").trim();

    const existing = await findEntrepriseByNormalizedName(trimmedNom);
    if (existing) {
      return errorResponse(
        res,
        "Une entreprise avec ce nom existe déjà",
        409
      );
    }

    const entreprise = await prisma.entreprise.create({
      data: { nom: trimmedNom, adresse }
    });

    // Provision canonical tenant roles (Admin, Membre) so the new enterprise is invitation-ready.
    try {
      await provisionTenantRoles(prisma as any, entreprise.id_entreprise, {
        enterpriseName: entreprise.nom,
      });
    } catch (err) {
      console.error(
        "[createEntreprise] provisionTenantRoles failed (non-fatal):",
        err
      );
    }

    // Create notification for SuperAdmin
    const superAdmin = await prisma.utilisateur.findFirst({
      where: { role: { nom: "SuperAdmin" } }
    });

    if (superAdmin) {
      await prisma.notification.create({
        data: {
          sujet: "Nouvelle Entreprise",
          message: `L'entreprise "${nom}" a été créée avec succès.`,
          type: "success",
          id_utilisateur: superAdmin.id_utilisateur,
          date_envoi: new Date(),
          metadata: JSON.stringify({
            path: "/enterprises",
            enterpriseId: entreprise.id_entreprise,
          }),
        }
      });
    }

    console.log("Entreprise créée dans la DB:", entreprise);

    try {
      await (prisma as any).activity.create({
        data: {
          user: "Super Admin",
          action: "Entreprise créée",
          entreprise: nom,
          status: "ACTIVE",
          type: "enterprise",
          entityId: entreprise.id_entreprise
        }
      });
      console.log("Activity logged");
    } catch (e) { console.error("Logging error", e); }

    return successResponse(res, entreprise, "Entreprise créée", 201);
  } catch (error) {
    console.error("Erreur dans createEntreprise:", error);
    next(error);
  }
};

// --- Liste toutes les entreprises ---
export const getAllEntreprises = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = paginate(req);

    await consolidateDuplicateEnterprisesByName();

    const merged = await buildMergedEnterpriseList();
    const items = merged.map((e) => {
      const admins = e.admins.map((a) => mapAdminPayload(a as AdminSelectRow));
      const base = mapEntreprisePayload({
        id_entreprise: e.id_entreprise,
        nom: e.nom,
        adresse: e.adresse,
        telephone: e.telephone,
        createdAt: e.createdAt,
        statut: e.statut,
        admin_id: e.admin_id,
        admin: (admins[0] ?? e.admin) as AdminSelectRow | null,
      });
      return {
        ...base,
        admins,
        adminCount: admins.length,
      };
    });
    const total = items.length;
    const pageItems = items.slice(skip, skip + limit);

    return successResponse(
      res,
      paginatedResponse(pageItems, total, page, limit),
      "Liste des entreprises"
    );
  } catch (error) {
    next(error);
  }
};

// --- Obtenir une entreprise par ID ---
export const getEntrepriseById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await consolidateDuplicateEnterprisesByName();
    const canonicalId = await resolveCanonicalEnterpriseId(parseInt(id as string, 10));
    const entreprise = await prisma.entreprise.findUnique({
      where: { id_entreprise: canonicalId },
      include: {
        projet: true,
        admin: {
          select: {
            id_utilisateur: true,
            nom: true,
            prenom: true,
            email: true,
            telephone: true,
            createdAt: true,
            isOnline: true,
            lastSeen: true,
          },
        },
        utilisateur: {
          include: { role: true }
        }
      }
    });

    if (!entreprise) {
      throw new Error("Entreprise inexistante");
    }

    const admins = await getEnterpriseAdminsByCompanyId(canonicalId);

    const mappedAdmins = admins.map((a) => mapAdminPayload(a as AdminSelectRow));
    const payload = {
      ...mapEntreprisePayload({
        id_entreprise: canonicalId,
        nom: entreprise.nom,
        adresse: entreprise.adresse,
        telephone: entreprise.telephone,
        createdAt: entreprise.createdAt,
        statut: entreprise.statut,
        admin_id: entreprise.admin_id,
        admin: (mappedAdmins[0] ?? entreprise.admin) as AdminSelectRow | null,
      }),
      admins: mappedAdmins,
      adminCount: mappedAdmins.length,
      projet: entreprise.projet,
      utilisateur: entreprise.utilisateur,
    };

    return successResponse(res, payload, "Entreprise trouvée");
  } catch (error) {
    next(error);
  }
};

// --- Mettre à jour une entreprise ---
export const updateEntreprise = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return errorResponse(res, "ID entreprise invalide", 400);
    }

    await consolidateDuplicateEnterprisesByName();
    const canonicalId = await resolveCanonicalEnterpriseId(id);

    const {
      nom,
      adresse,
      phoneCountryCode,
      phoneNumber,
      phone,
      telephone,
      admins: adminsBody,
    } = req.body;
    const trimmedNom = typeof nom === "string" ? nom.trim() : nom;
    const trimmedAdresse =
      typeof adresse === "string" ? adresse.trim() : adresse ?? "";

    let telephoneValue: string | null | undefined;
    if (phoneCountryCode !== undefined || phoneNumber !== undefined) {
      const national =
        typeof phoneNumber === "string"
          ? phoneNumber.replace(/\D/g, "")
          : "";
      if (!national.length) {
        telephoneValue = null;
      } else {
        const code =
          typeof phoneCountryCode === "string" && phoneCountryCode.trim()
            ? phoneCountryCode.trim()
            : "+216";
        telephoneValue = formatFullPhone(code, national);
      }
    } else if (phone !== undefined || telephone !== undefined) {
      const raw = phone ?? telephone;
      telephoneValue =
        typeof raw === "string" ? raw.trim() || null : raw ?? null;
    }

    const existing = await prisma.entreprise.findUnique({
      where: { id_entreprise: canonicalId },
      select: { id_entreprise: true, admin_id: true },
    });
    if (!existing) {
      return errorResponse(res, "Entreprise non trouvée", 404);
    }

    if (telephoneValue !== undefined && existing.admin_id) {
      await prisma.utilisateur.update({
        where: { id_utilisateur: existing.admin_id },
        data: { telephone: telephoneValue },
      });
    }

    if (Array.isArray(adminsBody) && adminsBody.length > 0) {
      const linkedAdmins = await getEnterpriseAdminsByCompanyId(canonicalId);
      const allowedIds = new Set(
        linkedAdmins.map((a) => a.id_utilisateur)
      );

      for (const entry of adminsBody) {
        const adminId = Number(entry.id_utilisateur);
        if (!allowedIds.has(adminId)) {
          return errorResponse(
            res,
            "Un administrateur ne correspond pas à cette entreprise",
            400
          );
        }

        const email =
          typeof entry.email === "string" ? entry.email.trim() : entry.email;
        const tel =
          entry.telephone === undefined
            ? undefined
            : entry.telephone === null
              ? null
              : String(entry.telephone).trim() || null;

        await prisma.utilisateur.update({
          where: { id_utilisateur: adminId },
          data: {
            email,
            ...(tel !== undefined ? { telephone: tel } : {}),
          },
        });
      }
    }

    const entreprise = await prisma.entreprise.update({
      where: { id_entreprise: canonicalId },
      data: {
        nom: trimmedNom,
        adresse: trimmedAdresse || null,
      },
      include: {
        admin: {
          select: {
            id_utilisateur: true,
            nom: true,
            prenom: true,
            email: true,
            telephone: true,
            createdAt: true,
            isOnline: true,
            lastSeen: true,
          },
        },
        utilisateur: {
          include: { role: true },
        },
        projet: true,
      },
    });

    const admins = await getEnterpriseAdminsByCompanyId(canonicalId);
    const mappedAdmins = admins.map((a) => mapAdminPayload(a as AdminSelectRow));

    const codeForPayload =
      typeof phoneCountryCode === "string" && phoneCountryCode.trim()
        ? phoneCountryCode.trim()
        : undefined;
    const nationalForPayload =
      typeof phoneNumber === "string" ? phoneNumber.replace(/\D/g, "") : undefined;

    const payload = {
      ...mapEntreprisePayload(
        {
          id_entreprise: canonicalId,
          nom: entreprise.nom,
          adresse: entreprise.adresse,
          telephone: entreprise.telephone,
          createdAt: entreprise.createdAt,
          statut: entreprise.statut,
          admin_id: entreprise.admin_id,
          admin: (mappedAdmins[0] ?? entreprise.admin) as AdminSelectRow | null,
        },
        telephoneValue !== undefined
          ? {
              telephone: telephoneValue,
              phoneCountryCode: codeForPayload,
              phoneNumber: nationalForPayload,
            }
          : undefined
      ),
      admins: mappedAdmins,
      adminCount: mappedAdmins.length,
      projet: entreprise.projet,
      utilisateur: entreprise.utilisateur,
    };

    return successResponse(res, payload, "Entreprise mise à jour");
  } catch (error) {
    next(error);
  }
};

// --- Supprimer une entreprise ---
export const deleteEntreprise = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return errorResponse(res, "ID entreprise invalide", 400);
    }

    const existing = await prisma.entreprise.findUnique({
      where: { id_entreprise: id },
      select: { id_entreprise: true, nom: true },
    });
    if (!existing) {
      return errorResponse(res, "Entreprise non trouvée", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.entreprise.update({
        where: { id_entreprise: id },
        data: { admin_id: null },
      });

      const roles = await tx.role.findMany({
        where: { id_entreprise: id },
        select: { id_role: true },
      });

      if (roles.length > 0) {
        const roleIds = roles.map((r) => r.id_role);
        await tx.utilisateur.updateMany({
          where: { id_role: { in: roleIds } },
          data: { id_role: null },
        });
        for (const { id_role } of roles) {
          await tx.role.update({
            where: { id_role },
            data: { permission: { set: [] } },
          });
        }
        await tx.role.deleteMany({ where: { id_entreprise: id } });
      }

      await tx.utilisateur.deleteMany({ where: { id_entreprise: id } });

      await tx.entreprise.delete({ where: { id_entreprise: id } });
    });

    return successResponse(res, null, "Entreprise supprimée");
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return errorResponse(res, "Entreprise non trouvée", 404);
      }
      if (error.code === "P2003") {
        return errorResponse(
          res,
          "Impossible de supprimer cette entreprise : des données liées empêchent la suppression.",
          409
        );
      }
    }
    next(error);
  }
};

export const inviteAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id_entreprise, email: rawEmail, nom, prenom, mot_de_passe } = req.body;

    // Normalize email to avoid case/whitespace mismatches at login time
    const email = String(rawEmail || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email requis." });
    }

    const canonicalEnterpriseId = await resolveCanonicalEnterpriseId(
      parseInt(id_entreprise as string, 10)
    );

    console.log(
      `[InviteAdmin] Tentative d'invitation pour ${email} dans l'entreprise ${canonicalEnterpriseId}`
    );

    // 1. Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.utilisateur.findUnique({
      where: { email }
    });
    if (existingUser) {
      console.log(`[InviteAdmin] Échec: L'email ${email} est déjà utilisé.`);
      return res.status(400).json({ message: "Un utilisateur avec cet email existe déjà." });
    }

    // 2. Trouver le rôle Admin (priorité à celui de l'entreprise)
    let adminRole = await prisma.role.findFirst({
      where: { 
        nom: { in: ["Admin", "ADMIN", "admin"] },
        id_entreprise: canonicalEnterpriseId,
      }
    });

    if (!adminRole) {
      console.log(`[InviteAdmin] Rôle Admin non trouvé pour l'entreprise ${id_entreprise}. Recherche d'un rôle global...`);
      adminRole = await prisma.role.findFirst({
        where: { nom: { in: ["Admin", "ADMIN", "admin"] } }
      });
    }

    if (!adminRole) {
      console.log(`[InviteAdmin] Échec: Rôle 'Admin' introuvable dans le système.`);
      return res.status(500).json({ message: "Le rôle 'Admin' n'existe pas dans le système. Veuillez le créer pour cette entreprise." });
    }

    // 3. Hasher le mot de passe
    const hashedPassword = await hashPassword(mot_de_passe);

    // 4. Créer l'utilisateur
    const user = await prisma.utilisateur.create({
      data: {
        nom,
        prenom,
        email,
        password: hashedPassword,
        id_role: adminRole.id_role,
        id_entreprise: canonicalEnterpriseId,
        statut: "ACTIVE"
      },
      include: { role: true }
    });

    console.log(`[InviteAdmin] Utilisateur créé avec succès (ID: ${user.id_utilisateur})`);

    // 5. Mettre à jour l'entreprise avec cet admin si elle n'en a pas
    const entreprise = await prisma.entreprise.findUnique({
      where: { id_entreprise: canonicalEnterpriseId },
    });
    if (entreprise && !entreprise.admin_id) {
      await prisma.entreprise.update({
        where: { id_entreprise: entreprise.id_entreprise },
        data: { admin_id: user.id_utilisateur }
      });
      console.log(`[InviteAdmin] Entreprise ${id_entreprise} liée à l'admin ${user.id_utilisateur}`);
    }

    // 6. Ajouter au groupe "Réunion Admins"
    let groupWarning = "";
    try {
      await MessagingService.addUserToAdminMeetingGroup(user.id_utilisateur);
      console.log(`[InviteAdmin] Utilisateur ajouté au groupe Réunion Admins`);
    } catch (groupError: any) {
      console.error("[InviteAdmin] Erreur lors de l'ajout au groupe Réunion Admins:", groupError.message);
      groupWarning = " (Note: échec de l'ajout au groupe Réunion Admins)";
    }

    try {
      await (prisma as any).activity.create({
        data: {
          user: prenom + " " + nom,
          action: "Administrateur invité",
          entreprise: entreprise?.nom || "Non spécifiée",
          status: "PENDING",
          type: "user",
          date: new Date()
        }
      });
      console.log("Activity created for admin invitation");
    } catch (e) {
      console.error("Logging error", e);
    }

    return successResponse(res, user, `Administrateur invité et créé avec succès${groupWarning}`, 201);
  } catch (error: any) {
    console.error("INVITE ADMIN ERROR:", error);
    res.status(500).json({ 
      message: error.message || "Échec de l'invitation", 
      error: error.message,
      details: "Une erreur interne est survenue lors de la création de l'administrateur."
    });
  }
};

// --- Activer / Désactiver une entreprise ---
export const toggleEntrepriseStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const existing = await prisma.entreprise.findUnique({
      where: { id_entreprise: parseInt(id as string) }
    });

    if (!existing) {
      throw new Error("Entreprise inexistante");
    }

    const newStatus = existing.statut === "active" ? "inactive" : "active";

    const entreprise = await prisma.entreprise.update({
      where: { id_entreprise: parseInt(id as string) },
      data: { statut: newStatus }
    });

    return successResponse(res, entreprise, `Entreprise ${newStatus === "active" ? "activée" : "désactivée"} avec succès`);
  } catch (error) {
    next(error);
  }
};