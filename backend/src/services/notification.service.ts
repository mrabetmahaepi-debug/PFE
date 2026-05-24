import prisma from "../prisma/prismaClient";
import { withNotificationDedupLock } from "../lib/notificationDedupLock";

const DEDUP_WINDOW_MS = 30_000;

export type NotificationCreatePayload = {
  sujet: string;
  message?: string;
  type?: string;
  id_utilisateur: number;
  metadata?: string | Record<string, unknown> | null;
  taskId?: number | null;
};

const notificationSelect = {
  num_notification: true,
  sujet: true,
  message: true,
  type: true,
  is_read: true,
  date_envoi: true,
  id_utilisateur: true,
  metadata: true,
} as const;

function parseMetadataObject(
  metadata: string | Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (metadata == null) return {};
  if (typeof metadata === "object" && !Array.isArray(metadata)) {
    return { ...metadata };
  }
  if (typeof metadata === "string" && metadata.trim()) {
    try {
      const parsed = JSON.parse(metadata) as Record<string, unknown>;
      return parsed && typeof parsed === "object" ? { ...parsed } : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function buildNotificationEventKey(
  sujet: string,
  taskId: number | null,
  userId: number
): string {
  const sujetNorm = String(sujet || "").trim();
  return `${sujetNorm}-${taskId ?? 0}-${userId}`;
}

function normalizeMetadata(
  metadata: string | Record<string, unknown> | null | undefined,
  eventKey: string,
  taskId: number | null
): string {
  const base = parseMetadataObject(metadata);
  base.eventKey = eventKey;
  if (taskId != null && Number.isFinite(taskId)) {
    base.taskId = taskId;
  }
  return JSON.stringify(base);
}

function extractTaskId(
  metadata: string | Record<string, unknown> | null | undefined,
  explicit?: number | null
): number | null {
  if (explicit != null && Number.isFinite(Number(explicit))) {
    return Number(explicit);
  }
  const base = parseMetadataObject(metadata);
  const raw = base.taskId;
  if (raw != null && Number.isFinite(Number(raw))) return Number(raw);
  return null;
}

async function findRecentDuplicateNotification(params: {
  userId: number;
  type: string;
  sujet: string;
  message: string;
  taskId: number | null;
  eventKey: string;
  since: Date;
}) {
  const recent = await prisma.notification.findMany({
    where: {
      id_utilisateur: params.userId,
      sujet: params.sujet,
      date_envoi: { gte: params.since },
    },
    orderBy: { date_envoi: "desc" },
    take: 20,
    select: notificationSelect,
  });

  for (const row of recent) {
    const meta = parseMetadataObject(row.metadata);
    const rowTaskId =
      meta.taskId != null && Number.isFinite(Number(meta.taskId))
        ? Number(meta.taskId)
        : null;

    if (params.taskId != null && rowTaskId === params.taskId) {
      return row;
    }

    if (meta.eventKey === params.eventKey) {
      return row;
    }

    if (
      params.message &&
      row.message === params.message &&
      row.type === params.type
    ) {
      return row;
    }
  }

  return null;
}

async function createNotificationOnce(data: NotificationCreatePayload) {
  const { sujet, message, type, id_utilisateur } = data;

  if (!sujet || !id_utilisateur) {
    throw new Error("sujet et id_utilisateur sont obligatoires");
  }

  const typeNorm = String(type || "info");
  const messageNorm = String(message || "");
  const userId = Number(id_utilisateur);
  const taskId = extractTaskId(data.metadata, data.taskId);
  const eventKey = buildNotificationEventKey(sujet, taskId, userId);
  const since = new Date(Date.now() - DEDUP_WINDOW_MS);

  console.log("[notification] triggered", {
    eventKey,
    userId,
    sujet,
    taskId,
  });

  const duplicate = await findRecentDuplicateNotification({
    userId,
    type: typeNorm,
    sujet,
    message: messageNorm,
    taskId,
    eventKey,
    since,
  });

  if (duplicate) {
    console.log("[notification] skipped duplicate", eventKey);
    return duplicate;
  }

  const created = await prisma.notification.create({
    data: {
      sujet,
      message: messageNorm,
      type: typeNorm,
      id_utilisateur: userId,
      date_envoi: new Date(),
      is_read: false,
      metadata: normalizeMetadata(data.metadata, eventKey, taskId),
    },
    select: notificationSelect,
  });

  console.log("[notification] created", eventKey, created.num_notification);
  return created;
}

export const getMyNotifications = async (userId: number) => {
  return prisma.notification.findMany({
    where: { id_utilisateur: userId },
    orderBy: { date_envoi: "desc" },
    select: notificationSelect,
  });
};

export const getUnreadCount = async (userId: number) => {
  return prisma.notification.count({
    where: { id_utilisateur: userId, is_read: false },
  });
};

export const createNotification = async (data: NotificationCreatePayload) => {
  const userId = Number(data.id_utilisateur);
  const taskId = extractTaskId(data.metadata, data.taskId);
  const eventKey = buildNotificationEventKey(data.sujet, taskId, userId);

  return withNotificationDedupLock(eventKey, () => createNotificationOnce(data));
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
    select: notificationSelect,
  });
};

export const markAllAsRead = async (userId: number) => {
  return prisma.notification.updateMany({
    where: { id_utilisateur: userId, is_read: false },
    data: { is_read: true },
  });
};

/** Alias explicite pour l’API / marquage boîte de réception. */
export const markAllNotificationsAsRead = markAllAsRead;

export const deleteNotification = async (
  notificationId: number,
  userId: number
) => {
  const existing = await prisma.notification.findUnique({
    where: { num_notification: notificationId },
  });

  if (!existing || existing.id_utilisateur !== userId) {
    throw new Error("Notification non trouvée");
  }

  await prisma.notification.delete({
    where: { num_notification: notificationId },
  });

  return { deleted: true };
};

export const deleteAllNotifications = async (userId: number) => {
  const result = await prisma.notification.deleteMany({
    where: { id_utilisateur: userId },
  });
  return { deleted: result.count };
};
