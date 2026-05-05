import { z } from "zod";

export const createTaskSchema = z.object({
  body: z.object({
    nom_t: z.string({ error: "Le nom de la tâche est obligatoire" }).min(2),
    description_t: z.string().optional(),
    statut_t: z.enum(["todo", "en_cours", "terminee"]).optional(),
    priorite: z.enum(["basse", "moyenne", "haute", "critique"]).optional(),
    date_debut_t: z.string().optional(), // Could be z.string().datetime() but keeping flexible
    date_fin_t: z.string().optional(),
    id_projet: z.number({ error: "id_projet est obligatoire" }),
    id_sprint: z.number().optional(),
    assigne_a: z.number().optional(),
  }),
});

export const updateTaskSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  body: z.object({
    nom_t: z.string().min(2).optional(),
    description_t: z.string().optional(),
    statut_t: z.enum(["todo", "en_cours", "terminee"]).optional(),
    priorite: z.enum(["basse", "moyenne", "haute", "critique"]).optional(),
    date_debut_t: z.string().optional(),
    date_fin_t: z.string().optional(),
    id_sprint: z.number().optional(),
  }),
});
