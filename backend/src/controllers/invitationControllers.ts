import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";
import { MessagingService } from "../services/messaging.service";

export const createInvitation = async (req: Request, res: Response) => {
  try {
    const { email, id_role, id_entreprise } = req.body;
    if (!email || !id_role) {
      return res.status(400).json({ error: "Email et id_role requis" });
    }

    const invitation = await prisma.invitation.create({
      data: {
        email,
        id_role,
        id_entreprise: id_entreprise ?? undefined
      }
    });

    res.status(201).json({ message: "Invitation créée", invitation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur création invitation" });
  }
};

export const getAllInvitations = async (req: Request, res: Response) => {
  try {
    const invitations = await prisma.invitation.findMany();
    res.json(invitations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const getInvitationById = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? parseInt(req.params.id[0]) : parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    const invitation = await prisma.invitation.findUnique({ where: { id_invitation: id } });
    if (!invitation) return res.status(404).json({ error: "Invitation non trouvée" });

    res.json(invitation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const updateInvitation = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? parseInt(req.params.id[0]) : parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    const { email, id_role } = req.body;
    const updatedInvitation = await prisma.invitation.update({
      where: { id_invitation: id },
      data: { email, id_role }
    });

    res.json({ message: "Invitation mise à jour", updatedInvitation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur mise à jour invitation" });
  }
};

export const deleteInvitation = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? parseInt(req.params.id[0]) : parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    await prisma.invitation.delete({ where: { id_invitation: id } });
    res.json({ message: "Invitation supprimée" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur suppression invitation" });
  }
};

export const acceptInvitation = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? parseInt(req.params.id[0]) : parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    const invitation = await prisma.invitation.findUnique({ where: { id_invitation: id } });
    if (!invitation) return res.status(404).json({ message: "Invitation non trouvée" });

    const existingUser = await prisma.utilisateur.findUnique({ where: { email: invitation.email! } });
    if (existingUser) return res.status(400).json({ message: "Un utilisateur avec cet email existe déjà" });

    const user = await prisma.utilisateur.create({
      data: {
        email: invitation.email!,
        id_role: invitation.id_role!,
        id_entreprise: invitation.id_entreprise ?? undefined,
        nom: "",
        prenom: ""
      }
    });


    if (invitation.id_role === 2 && invitation.id_entreprise) {
      await prisma.entreprise.update({
        where: { id_entreprise: invitation.id_entreprise },
        data: { admin_id: user.id_utilisateur }
      });
    }

    await prisma.invitation.delete({ where: { id_invitation: id } });

    // Auto-ajouter au groupe "Réunion Admins" si Admin
    await MessagingService.addUserToAdminMeetingGroup(user.id_utilisateur);

    res.json({ message: "Invitation acceptée", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur acceptation invitation" });
  }
};