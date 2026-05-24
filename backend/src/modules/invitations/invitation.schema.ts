import { z } from "zod";
import { passwordSchema } from "../auth/auth.schema";
import { isValidInvitationProfileLabel } from "../../lib/projectRoleLabels";

export const createInvitationSchema = z.object({
  email: z
    .string()
    .min(1, "Email requis")
    .email("Email invalide")
    .max(150, "Email trop long")
    .transform((v) => v.trim().toLowerCase()),
  id_role: z
    .number()
    .int("id_role doit être un entier")
    .positive("id_role doit être positif"),
  id_entreprise: z.number().int().positive().optional().nullable(),
  prenom: z.string().max(100).optional(),
  nom: z.string().max(100).optional(),
});

/**
 * Tenant-scoped multi-email invitation payload.
 * `id_entreprise` is intentionally NOT accepted here — the controller
 * forces it from `req.user.id_entreprise` so a tenant admin can never
 * invite into another tenant.
 */
export const createTeamInvitationSchema = z.object({
  emails: z
    .array(
      z
        .string()
        .min(1, "Email requis")
        .email("Email invalide")
        .max(150, "Email trop long")
        .transform((v) => v.trim().toLowerCase())
    )
    .min(1, "Veuillez fournir au moins un email")
    .max(50, "Trop d'emails à la fois (max 50)"),
  /** Ignoré : les invitations équipe utilisent toujours le rôle global « Membre ». */
  id_role: z
    .number()
    .int("id_role doit être un entier")
    .positive("id_role doit être positif")
    .optional(),
  /** Profil de permissions (Chef de projet ou Développeur) — stocké sur `utilisateur.poste`. */
  poste: z
    .string()
    .min(1, "Profil de permissions requis")
    .max(120, "Profil trop long")
    .transform((v) => v.trim())
    .refine((v) => isValidInvitationProfileLabel(v), {
      message:
        "Profil invalide. Choisissez « Chef de projet » ou « Développeur ».",
    }),
  prenom: z
    .string()
    .min(1, "Prénom requis")
    .max(100, "Prénom trop long")
    .transform((v) => v.trim()),
  nom: z
    .string()
    .min(1, "Nom requis")
    .max(100, "Nom trop long")
    .transform((v) => v.trim()),
  project_ids: z
    .array(z.number().int().positive())
    .min(1, "Sélectionnez au moins un projet accessible"),
  expires_at: z
    .string()
    .min(1, "Date d'expiration requise")
    .transform((v) => new Date(v))
    .refine((d) => !Number.isNaN(d.getTime()), {
      message: "Date d'expiration invalide",
    })
    .refine((d) => d.getTime() > Date.now(), {
      message: "La date d'expiration doit être dans le futur",
    })
    .refine(
      (d) => d.getTime() <= Date.now() + 365 * 24 * 60 * 60 * 1000,
      { message: "La date d'expiration ne peut pas dépasser un an" }
    ),
});

export const acceptInvitationByTokenSchema = z
  .object({
    token: z.string().min(20, "Token invalide"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirmation du mot de passe requise"),
    prenom: z
      .string()
      .min(1, "Prénom requis")
      .max(100, "Prénom trop long")
      .transform((v) => v.trim()),
    nom: z
      .string()
      .min(1, "Nom requis")
      .max(100, "Nom trop long")
      .transform((v) => v.trim()),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type CreateTeamInvitationInput = z.infer<typeof createTeamInvitationSchema>;
export type AcceptInvitationByTokenInput = z.infer<
  typeof acceptInvitationByTokenSchema
>;
