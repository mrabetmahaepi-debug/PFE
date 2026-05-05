import { Request, Response } from 'express';
import prisma from '../prisma/prismaClient';

export const getMyNotifications = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const notifications = await prisma.notification.findMany({
      where: { id_utilisateur: user.id },
      orderBy: { date_envoi: 'desc' },
      take: 20
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: "Erreur récupération notifications" });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    await prisma.notification.update({
      where: { num_notification: id },
      data: { is_read: true }
    });
    res.json({ message: "Notification lue" });
  } catch (error) {
    res.status(500).json({ error: "Erreur mise à jour notification" });
  }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    await prisma.notification.updateMany({
      where: { id_utilisateur: user.id, is_read: false },
      data: { is_read: true }
    });
    res.json({ message: "Toutes les notifications lues" });
  } catch (error) {
    res.status(500).json({ error: "Erreur mise à jour notifications" });
  }
};

// Helper to create notification
export const createNotification = async (userId: number, sujet: string, message: string, type: string = 'info') => {
  try {
    await prisma.notification.create({
      data: {
        id_utilisateur: userId,
        sujet,
        message,
        type,
        date_envoi: new Date()
      }
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
};
