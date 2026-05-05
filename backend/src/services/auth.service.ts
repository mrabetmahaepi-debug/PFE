import prisma from "../prisma/prismaClient";
import bcrypt from "bcrypt";

export const registerUser = async (data: any) => {
  const { email, password } = data;
  
  const nom = (data.nom || "").trim() || "Administrateur";
  const prenom = (data.prenom || "").trim() || email.split('@')[0];

  const existing = await prisma.utilisateur.findUnique({ where: { email } });

  if (existing) {
    throw new Error("Email déjà utilisé");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.utilisateur.create({
    data: {
      nom,
      prenom,
      email,
      password: hashedPassword,
      statut: "PENDING",
    },
    include: { role: true },
  });

  // Notifier le Super Admin (on assume que le rôle SuperAdmin a l'id 1 ou le nom "SuperAdmin")
  const superAdmins = await prisma.utilisateur.findMany({
    where: { role: { nom: "SuperAdmin" } }
  });

  for (const admin of superAdmins) {
    await prisma.notification.create({
      data: {
        sujet: "Nouvelle demande d'inscription",
        message: `${prenom} ${nom} s'est inscrit en tant qu'administrateur et attend votre validation.`,
        type: "warning",
        id_utilisateur: admin.id_utilisateur,
        date_envoi: new Date(),
        metadata: JSON.stringify({ action: 'approve_user', userId: user.id_utilisateur })
      }
    });
  }

  return user;
};

export const loginUser = async (email: string, password: string) => {
  const trimmedEmail = (email || "").trim();
  const user = await prisma.utilisateur.findUnique({
    where: { email: trimmedEmail },
    include: { role: true },
  });

  if (!user) {
    throw new Error("Utilisateur non trouvé");
  }

  if (user.statut !== "ACTIVE") {
    throw new Error("Votre compte est en attente de validation par l'administrateur.");
  }

  const valid = await bcrypt.compare(password, user.password || "");

  if (!valid) {
    throw new Error("Mot de passe incorrect");
  }

  return user;
};

export const getMe = async (userId: number) => {
  const user = await prisma.utilisateur.findUnique({
    where: { id_utilisateur: userId },
    include: { 
      role: {
        include: { permissions: true }
      } 
    },
  });

  if (!user) {
    throw new Error("Utilisateur non trouvé");
  }

  return {
    id: user.id_utilisateur,
    id_utilisateur: user.id_utilisateur,
    nom: user.nom,
    prenom: user.prenom,
    email: user.email,
    id_role: user.id_role,
    id_entreprise: user.id_entreprise,
    role: user.role?.nom || undefined,
    permissions: user.role?.permissions.map(p => p.nom) || [],
  };
};