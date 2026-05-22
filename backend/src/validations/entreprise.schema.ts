import { z } from "zod";
import { validatePhoneForCountry } from "../lib/phoneCountries";

export const createEntrepriseSchema = z.object({
  body: z.object({
    nom: z.string({ error: "Le nom de l'entreprise est obligatoire" }).min(2, "Le nom doit contenir au moins 2 caractères"),
    adresse: z.string({ error: "L'adresse est obligatoire" }).min(5, "L'adresse doit contenir au moins 5 caractères"),
  }),
});

const updateAdminEntrySchema = z.object({
  id_utilisateur: z.coerce.number().int().positive(),
  email: z.string().email("Email admin invalide"),
  telephone: z.string().max(255).nullable().optional(),
});

export const updateEntrepriseSchema = z.object({
  body: z
    .object({
      nom: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
      adresse: z.string().max(255).optional(),
      phoneCountryCode: z
        .string()
        .regex(/^\+\d{1,4}$/, "Indicatif pays invalide")
        .optional(),
      phoneNumber: z.string().max(15).optional(),
      phone: z.string().max(255).optional().nullable(),
      telephone: z.string().max(255).optional().nullable(),
      /** Super Admin: mettre à jour email/téléphone de plusieurs admins en une requête */
      admins: z.array(updateAdminEntrySchema).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.phoneCountryCode === undefined && data.phoneNumber === undefined) {
        return;
      }
      const digits = (data.phoneNumber ?? "").replace(/\D/g, "");
      if (!digits.length) return;
      const code = data.phoneCountryCode ?? "+216";
      const check = validatePhoneForCountry(code, digits);
      if (!check.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: check.message ?? "Numéro invalide",
          path: ["phoneNumber"],
        });
      }
    }),
  params: z.object({
    id: z.string().regex(/^\d+$/, "L'ID doit être un nombre valide"),
  }),
});

export const paginationQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }).optional(),
});

export const inviteAdminSchema = z.object({
  body: z.object({
    id_entreprise: z.coerce.number(),
    email: z.string().email("Email invalide"),
    id_role: z.coerce.number().optional(),
    nom: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
    prenom: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
    mot_de_passe: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  }),
});

export const approveUserSchema = z.object({
  body: z.object({
    id_entreprise: z.coerce.number(),
  }),
  params: z.object({
    id: z.string().regex(/^\d+$/, "L'ID doit être un nombre valide"),
  }),
});
