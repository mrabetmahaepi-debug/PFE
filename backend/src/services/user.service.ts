import prisma from "../prisma/prismaClient";

export const getMyProfile = async (userId: number) => {
  return prisma.utilisateur.findUnique({
    where: { id_utilisateur: userId },
    select: {
      id_utilisateur: true,
      nom: true,
      prenom: true,
      email: true,
      poste: true,
      telephone: true,
      id_role: true,
      id_entreprise: true,
    },
  });
};

export const updateMyProfile = async (userId: number, data: any) => {
  const { nom, prenom, telephone, poste } = data;

  return prisma.utilisateur.update({
    where: { id_utilisateur: userId },
    data: { nom, prenom, telephone, poste },
    select: {
      id_utilisateur: true,
      nom: true,
      prenom: true,
      email: true,
      poste: true,
      telephone: true,
      id_role: true,
      id_entreprise: true,
    },
  });
};