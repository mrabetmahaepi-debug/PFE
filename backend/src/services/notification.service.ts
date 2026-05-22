import prisma from "../prisma/prismaClient";

export const getMyNotifications = async (userId: number) => {
  return prisma.notification.findMany({
    where: { id_utilisateur: userId },
    orderBy: { date_envoi: "desc" },
    select: {
      num_notification: true,
      sujet: true,
      message: true,
      type: true,
      is_read: true,
      date_envoi: true,
      id_utilisateur: true,
      metadata: true,
    },
  });
};

export const createNotification = async (data: any) => {
  const { sujet, message, type, id_utilisateur } = data;

  if (!sujet || !id_utilisateur) {
    throw new Error("sujet et id_utilisateur sont obligatoires");
  }

  return prisma.notification.create({
    data: {
      sujet,
      message: message || "",
      type: type || "info",
      id_utilisateur,
      date_envoi: new Date(),
      is_read: false,
    },
    select: {
      num_notification: true,
      sujet: true,
      message: true,
      type: true,
      is_read: true,
      date_envoi: true,
      id_utilisateur: true,
      metadata: true,
    },
  });
};

export const markAsRead = async (notificationId: number, userId: number) => {
  const existing = await prisma.notification.findUnique({
    where: { num_notification: notificationId },
  });

  if (!existing || existing.id_utilisateur !== userId) {
    throw new Error("Notification non trouvée");
  }

  return prisma.notification.update({
    where: { num_notification: notificationId },
    data: { is_read: true },
    select: {
      num_notification: true,
      sujet: true,
      message: true,
      type: true,
      is_read: true,
      date_envoi: true,
      id_utilisateur: true,
      metadata: true,
    },
  });
};

export const markAllAsRead = async (userId: number) => {
  return prisma.notification.updateMany({
    where: { id_utilisateur: userId, is_read: false },
    data: { is_read: true },
  });
};