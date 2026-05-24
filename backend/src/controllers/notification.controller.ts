import { Request, Response } from "express";
import {
  getMyNotifications,
  getUnreadCount,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} from "../services/notification.service";

export const getMyNotificationsController = async (req: any, res: Response) => {
  try {
    const notifications = await getMyNotifications(req.user.id);
    return res.status(200).json(notifications);
  } catch (error: any) {
    return res.status(500).json({
      message: "Erreur lors de la récupération des notifications",
      error: error.message
    });
  }
};

export const getUnreadCountController = async (req: any, res: Response) => {
  try {
    const count = await getUnreadCount(req.user.id);
    return res.status(200).json({ count });
  } catch (error: any) {
    return res.status(500).json({
      message: "Erreur lors du comptage des notifications non lues",
      error: error.message,
    });
  }
};

export const createNotificationController = async (req: Request, res: Response) => {
  try {
    const { sujet, message, type, id_utilisateur } = req.body;

    if (!sujet || !id_utilisateur) {
      return res.status(400).json({
        message: "sujet et id_utilisateur sont obligatoires"
      });
    }

    const notification = await createNotification({
      sujet,
      message,
      type,
      id_utilisateur
    });

    return res.status(201).json(notification);
  } catch (error: any) {
    return res.status(500).json({
      message: "Erreur lors de la création de la notification",
      error: error.message
    });
  }
};

export const markAsReadController = async (req: Request, res: Response) => {
  try {
    const notificationId = Number(req.params.id);

    if (isNaN(notificationId) || notificationId <= 0) {
      return res.status(400).json({
        message: "id de notification invalide"
      });
    }

    const updatedNotification = await markAsRead(notificationId, (req as any).user.id);

    return res.status(200).json(updatedNotification);
  } catch (error: any) {
    return res.status(500).json({
      message: "Erreur lors du marquage de la notification comme lue",
      error: error.message
    });
  }
};

export const markAllAsReadController = async (req: any, res: Response) => {
  try {
    await markAllAsRead(req.user.id);
    return res.status(200).json({ message: "Toutes les notifications ont été marquées comme lues" });
  } catch (error: any) {
    return res.status(500).json({
      message: "Erreur lors du marquage de toutes les notifications",
      error: error.message
    });
  }
};

export const deleteAllNotificationsController = async (req: any, res: Response) => {
  try {
    const result = await deleteAllNotifications(req.user.id);
    return res.status(200).json({
      message: "Toutes les notifications ont été supprimées",
      deleted: result.deleted,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Erreur lors de la suppression des notifications",
      error: error.message,
    });
  }
};

export const deleteNotificationController = async (req: any, res: Response) => {
  try {
    const notificationId = Number(req.params.id);

    if (isNaN(notificationId) || notificationId <= 0) {
      return res.status(400).json({
        message: "id de notification invalide",
      });
    }

    await deleteNotification(notificationId, req.user.id);
    return res.status(200).json({ message: "Notification supprimée" });
  } catch (error: any) {
    const status =
      error.message === "Notification non trouvée" ? 404 : 500;
    return res.status(status).json({
      message:
        error.message === "Notification non trouvée"
          ? error.message
          : "Erreur lors de la suppression de la notification",
      error: error.message,
    });
  }
};