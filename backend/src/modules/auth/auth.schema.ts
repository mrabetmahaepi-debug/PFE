import { z } from "zod";
import { validatePhoneForCountry } from "../../lib/phoneCountries";

export const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit faire au moins 8 caractères")
  .max(128, "Le mot de passe est trop long")
  .regex(/[a-z]/, "Le mot de passe doit contenir une minuscule")
  .regex(/[A-Z]/, "Le mot de passe doit contenir une majuscule")
  .regex(/[0-9]/, "Le mot de passe doit contenir un chiffre");

export const registerSchema = z.object({
  email: z
    .string()
    .min(1, "Email requis")
    .email("Email invalide")
    .max(150, "Email trop long")
    .transform((v) => v.trim().toLowerCase()),
  password: passwordSchema,
  prenom: z
    .string()
    .max(100, "Prénom trop long")
    .optional()
    .transform((v) => (v ? v.trim() || undefined : undefined)),
  nom: z
    .string()
    .max(100, "Nom trop long")
    .optional()
    .transform((v) => (v ? v.trim() || undefined : undefined)),
  /** Required for public admin self-registration — company the admin will manage. */
  entrepriseNom: z
    .string()
    .min(2, "Le nom de l'entreprise est requis (au moins 2 caractères)")
    .max(100, "Nom d'entreprise trop long")
    .transform((v) => v.trim()),
  companyAddress: z
    .string()
    .min(3, "L'adresse de l'entreprise est requise (au moins 3 caractères)")
    .max(255, "Adresse trop longue")
    .transform((v) => v.trim()),
  phoneCountryCode: z
    .string()
    .regex(/^\+\d{1,4}$/, "Indicatif pays invalide"),
  phoneNumber: z
    .string()
    .min(1, "Le numéro de téléphone est requis")
    .max(15, "Numéro trop long")
    .transform((v) => v.replace(/\D/g, "")),
}).superRefine((data, ctx) => {
  const phoneCheck = validatePhoneForCountry(data.phoneCountryCode, data.phoneNumber);
  if (!phoneCheck.valid) {
    ctx.addIssue({
      code: "custom",
      path: ["phoneNumber"],
      message: phoneCheck.message ?? "Numéro de téléphone invalide",
    });
  }
});

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email requis")
    .email("Email invalide")
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, "Mot de passe requis"),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email requis")
    .email("Email invalide")
    .transform((v) => v.trim().toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Jeton de réinitialisation requis"),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
