import prisma from "../prisma/prismaClient";

const profileSelect = {
  id_utilisateur: true,
  nom: true,
  prenom: true,
  email: true,
  poste: true,
  telephone: true,
  id_role: true,
  id_entreprise: true,
  photoUrl: true,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ProfileUpdateError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const getMyProfile = async (userId: number) => {
  return prisma.utilisateur.findUnique({
    where: { id_utilisateur: userId },
    select: profileSelect,
  });
};

export const updateMyProfile = async (userId: number, data: Record<string, unknown>) => {
  const updateData: {
    nom?: string;
    prenom?: string;
    telephone?: string | null;
    poste?: string | null;
    email?: string;
  } = {};

  if (data.nom !== undefined) {
    const nom = String(data.nom).trim();
    if (nom.length < 1) throw new ProfileUpdateError("Le nom est requis.");
    updateData.nom = nom;
  }

  if (data.prenom !== undefined) {
    const prenom = String(data.prenom).trim();
    if (prenom.length < 1) throw new ProfileUpdateError("Le prénom est requis.");
    updateData.prenom = prenom;
  }

  if (data.telephone !== undefined) {
    const tel = String(data.telephone).trim();
    updateData.telephone = tel || null;
  }

  if (data.poste !== undefined) {
    const poste = String(data.poste).trim();
    updateData.poste = poste || null;
  }

  if (data.email !== undefined) {
    const email = String(data.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      throw new ProfileUpdateError("Adresse e-mail invalide.");
    }
    const existing = await prisma.utilisateur.findFirst({
      where: {
        email,
        NOT: { id_utilisateur: userId },
      },
      select: { id_utilisateur: true },
    });
    if (existing) {
      throw new ProfileUpdateError("Cette adresse e-mail est déjà utilisée.");
    }
    updateData.email = email;
  }

  if (Object.keys(updateData).length === 0) {
    throw new ProfileUpdateError("Aucune modification à enregistrer.");
  }

  return prisma.utilisateur.update({
    where: { id_utilisateur: userId },
    data: updateData,
    select: profileSelect,
  });
};