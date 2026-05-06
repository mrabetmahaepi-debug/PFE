import { Request, Response } from "express";
import prisma from "../prisma/prismaClient";
import { MessagingService } from "../services/messaging.service";

export const getConversations = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userRole = typeof user.role === 'string' ? user.role : user.role?.nom;
    const isAdminOrSuper = ["SuperAdmin", "Admin"].includes(userRole);

    // Initialiser le groupe système au cas où
    if (isAdminOrSuper) {
      await MessagingService.initAdminMeetingGroup();
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        participant: {
          some: { id_utilisateur: user.id }
        },
        OR: [
          { is_system: false },
          { is_system: true, participant: { some: { id_utilisateur: user.id } } }
        ]
      } as any,
      include: {
        participant: {
          include: {
            utilisateur: {
              select: { nom: true, prenom: true, email: true }
            }
          }
        },
        message: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      } as any,
      orderBy: { updatedAt: 'desc' }
    });

    // Formatter pour le frontend (renommer participant -> participants, message -> messages)
    const formatted = conversations.map((c: any) => ({
      ...c,
      participants: c.participant,
      messages: c.message
    }));

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la récupération des conversations" });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    const user = (req as any).user;

    // Vérifier si l'utilisateur participe à cette conversation
    const participant = await prisma.participant.findUnique({
      where: {
        id_utilisateur_id_conversation: {
          id_utilisateur: user.id,
          id_conversation: parseInt(id)
        }
      }
    });

    if (!participant) {
      return res.status(403).json({ message: "Vous n'avez pas accès à cette conversation" });
    }

    const messages = await prisma.message.findMany({
      where: { id_conversation: parseInt(id) },
      include: {
        utilisateur: {
          select: { id_utilisateur: true, nom: true, prenom: true }
        }
      } as any,
      orderBy: { createdAt: 'asc' }
    });

    // Formatter pour le frontend (utilisateur -> expediteur)
    const formatted = messages.map((m: any) => ({
      ...m,
      expediteur: m.utilisateur
    }));

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la récupération des messages" });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { contenu, type, metadata } = req.body;
  
  try {
    if (!contenu || !type) {
      return res.status(400).json({ message: "Le contenu et le type sont obligatoires." });
    }

    const user = (req as any).user;

    // Validation spécifique pour les réunions
    if (type === 'meeting' && metadata) {
      const { titre, date, lien } = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      if (!titre || !date || !lien) {
        return res.status(400).json({ message: "Les informations de réunion (titre, date, lien) sont obligatoires." });
      }
    }

    const message = await prisma.message.create({
      data: {
        id_conversation: parseInt(id),
        id_expediteur: user.id,
        contenu,
        type: type || "text",
        metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null
      },
      include: {
        utilisateur: {
          select: { id_utilisateur: true, nom: true, prenom: true }
        }
      } as any
    });

    // Mettre à jour le updatedAt de la conversation
    await prisma.conversation.update({
      where: { id_conversation: parseInt(id) },
      data: { updatedAt: new Date() }
    });

    // Formatter pour le frontend
    const formatted = {
      ...message,
      expediteur: (message as any).utilisateur
    };

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de l'envoi du message" });
  }
};
