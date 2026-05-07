import { z } from "zod";

export const createEntrepriseSchema = z.object({
  body: z.object({
    nom: z.string({ error: "Le nom de l'entreprise est obligatoire" }).min(2, "Le nom doit contenir au moins 2 caractères"),
    adresse: z.string({ error: "L'adresse est obligatoire" }).min(5, "L'adresse doit contenir au moins 5 caractères"),
  }),
});

export const updateEntrepriseSchema = z.object({
  body: z.object({
    nom: z.string().min(2).optional(),
    adresse: z.string().min(5).optional(),
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
    id_entreprise: z.coerce.number().optional(),
  }),
  params: z.object({
    id: z.string().regex(/^\d+$/, "L'ID doit être un nombre valide"),
  }),
});
