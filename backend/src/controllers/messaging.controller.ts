import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import prisma from "../prisma/prismaClient";
import { MessagingService } from "../services/messaging.service";
import { isSuperAdmin } from "../middleware/permissions";
import { isTenantAdminUser } from "../lib/projectAccess";
import {
  isAllowedMessageAttachment,
  isAllowedVoiceAttachment,
  messageAttachmentUpload,
} from "../middleware/messageAttachmentUpload";

const ALLOWED_REACTION_EMOJIS = new Set(["👍", "❤️", "😂", "😮", "👏", "✅"]);

function aggregateReactionsForViewer(
  rows: { emoji: string; id_utilisateur: number }[],
  viewerId: number
): { emoji: string; count: number; reactedByMe: boolean }[] {
  const byEmoji = new Map<string, { count: number; reactedByMe: boolean }>();
  for (const r of rows) {
    if (!ALLOWED_REACTION_EMOJIS.has(r.emoji)) continue;
    const cur = byEmoji.get(r.emoji) ?? { count: 0, reactedByMe: false };
    cur.count += 1;
    if (r.id_utilisateur === viewerId) cur.reactedByMe = true;
    byEmoji.set(r.emoji, cur);
  }
  return [...byEmoji.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([emoji, v]) => ({ emoji, count: v.count, reactedByMe: v.reactedByMe }));
}

function serializeMessageDocument(m: any, viewerId: number): any {
  const reactionRows = m.reactions ?? [];
  const reactions = aggregateReactionsForViewer(reactionRows, viewerId);
  const expediteur = m.utilisateur ?? m.expediteur;

  if (m.deletedAt != null) {
    return {
      id_message: m.id_message,
      id_conversation: m.id_conversation,
      id_expediteur: m.id_expediteur,
      contenu: "",
      type: "text",
      metadata: null,
      attachmentUrl: null,
      attachmentName: null,
      attachmentMime: null,
      attachmentSize: null,
      createdAt: m.createdAt,
      editedAt: null,
      deletedAt: m.deletedAt,
      deleted: true,
      expediteur,
      reactions,
    };
  }

  const base: any = {
    id_message: m.id_message,
    id_conversation: m.id_conversation,
    id_expediteur: m.id_expediteur,
    contenu: m.contenu,
    type: m.type,
    metadata: m.metadata,
    attachmentUrl: m.attachmentUrl,
    attachmentName: m.attachmentName,
    attachmentMime: m.attachmentMime,
    attachmentSize: m.attachmentSize,
    createdAt: m.createdAt,
    editedAt: m.editedAt ?? null,
    deletedAt: m.deletedAt ?? null,
    expediteur,
    reactions,
  };

  if (String(m.type).toLowerCase() === "voice" && m.attachmentUrl) {
    let attachmentType: string | null = m.attachmentMime ?? null;
    if (m.metadata && typeof m.metadata === "string") {
      try {
        const meta = JSON.parse(m.metadata) as { attachmentType?: string };
        if (typeof meta.attachmentType === "string" && meta.attachmentType) {
          attachmentType = meta.attachmentType;
        }
      } catch {
        /* ignore */
      }
    }
    return {
      ...base,
      audioUrl: m.attachmentUrl,
      attachmentType,
    };
  }
  return base;
}

async function assertConversationParticipant(
  userId: number,
  conversationId: number
): Promise<boolean> {
  const p = await prisma.participant.findUnique({
    where: {
      id_utilisateur_id_conversation: {
        id_utilisateur: userId,
        id_conversation: conversationId,
      },
    },
  });
  return !!p;
}

async function canTenantAdminModerateConversation(
  user: { id: number; role?: string | null; id_entreprise?: number | null },
  conversation: { id_entreprise: number | null; is_system: boolean }
): Promise<boolean> {
  if (!isTenantAdminUser({ role: user.role }) || user.id_entreprise == null) {
    return false;
  }
  if (conversation.is_system) return false;
  return conversation.id_entreprise === user.id_entreprise;
}

function isEditableMessageDoc(m: {
  type: string;
  contenu: string;
  deletedAt?: Date | null;
}): boolean {
  if (m.deletedAt != null) return false;
  const t = String(m.type).toLowerCase();
  if (t === "meeting" || t === "voice") return false;
  if (t === "text") return true;
  if (t === "image" || t === "file") {
    return String(m.contenu ?? "").trim().length > 0;
  }
  return false;
}

function normalizeProjectRoleLabel(s: string | null | undefined): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isChefDeProjetRole(role_projet: string | null | undefined): boolean {
  return normalizeProjectRoleLabel(role_projet) === "chef de projet";
}

/** Admin d'entreprise (rôle global), hors SuperAdmin. */
function isEnterpriseGlobalAdminRole(roleNom: string | null | undefined): boolean {
  return (
    isTenantAdminUser({ role: roleNom }) && !isSuperAdmin({ role: roleNom as string })
  );
}

function formatConversation(c: any) {
  return {
    ...c,
    participants: c.participant ?? c.participants ?? [],
    messages: c.message ?? c.messages ?? [],
  };
}

/**
 * Modification / suppression de discussion ou membres :
 * - Admin d'entreprise : discussions non système de son entreprise.
 * - Super administrateur : toute discussion non système (toutes entreprises).
 */
async function assertMessagingAdminCanManageConversation(
  user: { id: number; role?: string | null; id_entreprise?: number | null },
  conversationId: number
): Promise<
  | { ok: true; conversation: { id_conversation: number; is_system: boolean; id_entreprise: number | null } }
  | { ok: false; status: number; message: string }
> {
  const conversation = await prisma.conversation.findUnique({
    where: { id_conversation: conversationId },
    select: { id_conversation: true, is_system: true, id_entreprise: true },
  });
  if (!conversation) {
    return { ok: false, status: 404, message: "Conversation introuvable." };
  }
  if (conversation.is_system) {
    return {
      ok: false,
      status: 403,
      message: "Cette conversation système ne peut pas être modifiée.",
    };
  }
  if (isSuperAdmin(user)) {
    return { ok: true, conversation };
  }
  if (!isTenantAdminUser({ role: user.role }) || user.id_entreprise == null) {
    return { ok: false, status: 403, message: "Réservé aux administrateurs de l'entreprise." };
  }
  if (conversation.id_entreprise !== user.id_entreprise) {
    return { ok: false, status: 403, message: "Accès refusé à cette conversation." };
  }
  return { ok: true, conversation };
}

export const getConversations = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = Number(user?.id);
    if (!Number.isFinite(userId) || userId < 1) {
      return res.status(401).json({ message: "Non authentifié.", conversations: [] });
    }

    if (isSuperAdmin(user) || isTenantAdminUser({ role: user.role })) {
      try {
        await MessagingService.initAdminMeetingGroup();
        if (isSuperAdmin(user)) {
          await MessagingService.addUserToAdminMeetingGroup(userId);
        }
      } catch (e) {
        console.error("[getConversations] initAdminMeetingGroup failed:", e);
      }
    }

    // Toute conversation où l'utilisateur est participant (Membre = groupes auxquels il est ajouté).
    const conversations = await prisma.conversation.findMany({
      where: {
        participant: {
          some: { id_utilisateur: userId },
        },
      },
      include: {
        participant: {
          include: {
            utilisateur: {
              select: { nom: true, prenom: true, email: true },
            },
          },
        },
        message: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      } as any,
      orderBy: { updatedAt: "desc" },
    });

    const formatted = conversations.map((c: any) => formatConversation(c));

    return res.status(200).json({ conversations: formatted });
  } catch (error: unknown) {
    const err = error as Error & { code?: string; meta?: unknown };
    console.error(
      "[getConversations] error:",
      err?.message,
      "code:",
      err?.code,
      "meta:",
      err?.meta,
      err?.stack
    );
    const devHint =
      process.env.NODE_ENV !== "production" && err?.message
        ? ` (${err.message})`
        : "";
    return res.status(500).json({
      message: `Erreur lors de la récupération des conversations${devHint}`,
      code: err?.code,
      conversations: [],
    });
  }
};

export const getConversationById = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const conversationId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(conversationId) || conversationId < 1) {
      return res.status(400).json({ message: "ID conversation invalide." });
    }

    const membership = await prisma.participant.findUnique({
      where: {
        id_utilisateur_id_conversation: {
          id_utilisateur: user.id,
          id_conversation: conversationId,
        },
      },
    });
    if (!membership) {
      return res.status(403).json({ message: "Vous n'avez pas accès à cette conversation" });
    }

    const conv = await prisma.conversation.findUnique({
      where: { id_conversation: conversationId },
      include: {
        participant: {
          include: {
            utilisateur: {
              select: { nom: true, prenom: true, email: true },
            },
          },
        },
        message: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      } as any,
    });
    if (!conv) {
      return res.status(404).json({ message: "Conversation introuvable." });
    }

    res.json(formatConversation(conv));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la récupération de la conversation" });
  }
};

export const getTeamMembersForMessaging = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let entId: number;
    if (isSuperAdmin(user)) {
      const raw = req.query.entrepriseId ?? req.query.id_entreprise;
      const parsed = parseInt(String(raw ?? ""), 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        const users = await prisma.utilisateur.findMany({
          where: { statut: "ACTIVE" },
          include: {
            role: { select: { nom: true } },
            entreprise: { select: { nom: true } },
          },
          orderBy: [{ nom: "asc" }, { prenom: "asc" }],
        });
        const filtered = users.filter((u) =>
          isEnterpriseGlobalAdminRole(u.role?.nom ?? null)
        );
        const payload = filtered.map((u) => ({
          id_utilisateur: u.id_utilisateur,
          prenom: u.prenom,
          nom: u.nom,
          email: u.email,
          globalRole: u.role?.nom ?? null,
          projectRoles: [] as { id_projet: number; nom_p: string; role_projet: string }[],
          isChefDeProjet: false,
          entrepriseNom: u.entreprise?.nom ?? null,
        }));
        return res.json(payload);
      }
      const ent = await prisma.entreprise.findUnique({
        where: { id_entreprise: parsed },
        select: { id_entreprise: true },
      });
      if (!ent) {
        return res.status(404).json({ message: "Entreprise introuvable." });
      }
      entId = parsed;
    } else {
      if (!isTenantAdminUser({ role: user.role }) || user.id_entreprise == null) {
        return res.status(403).json({
          message: "Réservé aux administrateurs de l'entreprise.",
        });
      }
      entId = Number(user.id_entreprise);
    }

    const users = await prisma.utilisateur.findMany({
      where: {
        id_entreprise: entId,
        statut: "ACTIVE",
      },
      include: {
        role: { select: { nom: true } },
        membre_projet: {
          include: {
            projet: { select: { nom_p: true, id_entreprise: true } },
          },
        },
      },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    });

    const payload = users.map((u) => {
      const projectRoles = (u.membre_projet ?? [])
        .filter((m) => (m.projet?.id_entreprise ?? null) === entId)
        .map((m) => ({
          id_projet: m.id_projet,
          nom_p: m.projet?.nom_p ?? "",
          role_projet: (m.role_projet ?? "").trim() || "Membre",
        }));
      const isChefDeProjet = projectRoles.some((pr) =>
        isChefDeProjetRole(pr.role_projet)
      );
      return {
        id_utilisateur: u.id_utilisateur,
        prenom: u.prenom,
        nom: u.nom,
        email: u.email,
        globalRole: u.role?.nom ?? null,
        projectRoles,
        isChefDeProjet,
      };
    });

    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors du chargement de l'équipe." });
  }
};

export const createConversation = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const nom = String(req.body?.nom ?? "").trim();
    const description =
      req.body?.description != null && String(req.body.description).trim() !== ""
        ? String(req.body.description).trim()
        : null;

    if (!nom || nom.length > 100) {
      return res.status(400).json({ message: "Le nom de la discussion est obligatoire (100 car. max)." });
    }

    if (isSuperAdmin(user)) {
      const rawList: unknown[] = Array.isArray(req.body?.selectedAdminIds)
        ? req.body.selectedAdminIds
        : Array.isArray(req.body?.participantIds)
          ? req.body.participantIds
          : [];
      const selected = new Set<number>();
      for (const x of rawList) {
        const n = Number(x);
        if (Number.isFinite(n) && n > 0) selected.add(Math.floor(n));
      }
      selected.delete(user.id);
      if (selected.size === 0) {
        return res.status(400).json({
          message: "Sélectionnez au moins un administrateur.",
        });
      }
      selected.add(user.id);

      const members = await prisma.utilisateur.findMany({
        where: {
          id_utilisateur: { in: [...selected] },
          statut: "ACTIVE",
        },
        include: { role: { select: { nom: true } } },
      });
      if (members.length !== selected.size) {
        return res.status(400).json({
          message: "Un ou plusieurs utilisateurs sont introuvables ou inactifs.",
        });
      }
      for (const m of members) {
        if (m.id_utilisateur === user.id) continue;
        if (!isEnterpriseGlobalAdminRole(m.role?.nom ?? null)) {
          return res.status(400).json({
            message:
              "Seuls les administrateurs d'entreprise (rôle global Admin) peuvent être invités.",
          });
        }
      }

      const created = await prisma.$transaction(async (tx) => {
        const conv = await tx.conversation.create({
          data: {
            nom,
            description,
            is_group: true,
            is_system: false,
            id_entreprise: null,
            created_by_id: user.id,
            updatedAt: new Date(),
          },
        });

        for (const uid of selected) {
          const m = members.find((x) => x.id_utilisateur === uid)!;
          const isAdm =
            uid === user.id
              ? true
              : isEnterpriseGlobalAdminRole(m.role?.nom ?? null);
          await tx.participant.create({
            data: {
              id_conversation: conv.id_conversation,
              id_utilisateur: uid,
              isAdmin: !!isAdm,
            },
          });
        }

        return tx.conversation.findUnique({
          where: { id_conversation: conv.id_conversation },
          include: {
            participant: {
              include: {
                utilisateur: {
                  select: { nom: true, prenom: true, email: true },
                },
              },
            },
            message: {
              take: 1,
              orderBy: { createdAt: "desc" },
            },
          } as any,
        });
      });

      if (!created) {
        return res.status(500).json({ message: "Création incomplète." });
      }
      return res.status(201).json(formatConversation(created));
    }

    if (!isTenantAdminUser({ role: user.role }) || user.id_entreprise == null) {
      return res.status(403).json({
        message: "Réservé aux administrateurs de l'entreprise.",
      });
    }
    const entId = Number(user.id_entreprise);

    const participantIdsRaw: unknown[] = Array.isArray(req.body?.participantIds)
      ? req.body.participantIds
      : [];
    const addAllChefs = Boolean(req.body?.addAllChefs);

    const projectIds = (
      await prisma.projet.findMany({
        where: { id_entreprise: entId },
        select: { id_projet: true },
      })
    ).map((p) => p.id_projet);

    const chefUserIds = new Set<number>();
    if (addAllChefs && projectIds.length > 0) {
      const rows = await prisma.membre_projet.findMany({
        where: { id_projet: { in: projectIds } },
        select: { id_utilisateur: true, role_projet: true },
      });
      for (const r of rows) {
        if (isChefDeProjetRole(r.role_projet)) {
          chefUserIds.add(r.id_utilisateur);
        }
      }
    }

    const requested = new Set<number>();
    for (const x of participantIdsRaw) {
      const n = Number(x);
      if (Number.isFinite(n) && n > 0) requested.add(Math.floor(n));
    }
    for (const id of chefUserIds) requested.add(id);
    requested.add(user.id);

    const members = await prisma.utilisateur.findMany({
      where: {
        id_utilisateur: { in: [...requested] },
        id_entreprise: entId,
        statut: "ACTIVE",
      },
      select: { id_utilisateur: true, role: { select: { nom: true } } },
    });
    const allowed = new Set(members.map((m) => m.id_utilisateur));
    if (allowed.size !== requested.size) {
      return res.status(400).json({
        message: "Un ou plusieurs utilisateurs ne font pas partie de votre entreprise.",
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const conv = await tx.conversation.create({
        data: {
          nom,
          description,
          is_group: true,
          is_system: false,
          id_entreprise: entId,
          created_by_id: user.id,
          updatedAt: new Date(),
        },
      });

      for (const uid of allowed) {
        const u = members.find((m) => m.id_utilisateur === uid);
        const isAdm = isTenantAdminUser({ role: u?.role?.nom ?? null });
        await tx.participant.create({
          data: {
            id_conversation: conv.id_conversation,
            id_utilisateur: uid,
            isAdmin: isAdm,
          },
        });
      }

      return tx.conversation.findUnique({
        where: { id_conversation: conv.id_conversation },
        include: {
          participant: {
            include: {
              utilisateur: {
                select: { nom: true, prenom: true, email: true },
              },
            },
          },
          message: {
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        } as any,
      });
    });

    if (!created) {
      return res.status(500).json({ message: "Création incomplète." });
    }
    res.status(201).json(formatConversation(created));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la création de la discussion." });
  }
};

export const addConversationParticipants = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const conversationId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(conversationId) || conversationId < 1) {
      return res.status(400).json({ message: "ID conversation invalide." });
    }
    const gate = await assertMessagingAdminCanManageConversation(user, conversationId);
    if (!gate.ok) {
      return res.status(gate.status).json({ message: gate.message });
    }

    const userIdsRaw: unknown[] = Array.isArray(req.body?.userIds)
      ? req.body.userIds
      : [];
    const toAdd = new Set<number>();
    for (const x of userIdsRaw) {
      const n = Number(x);
      if (Number.isFinite(n) && n > 0) toAdd.add(Math.floor(n));
    }
    if (toAdd.size === 0) {
      return res.status(400).json({ message: "Aucun utilisateur à ajouter." });
    }

    const entId = gate.conversation.id_entreprise;
    let validUsers: { id_utilisateur: number; role: { nom: string | null } | null }[];
    if (entId == null) {
      if (!isSuperAdmin(user)) {
        return res.status(403).json({
          message: "Seul le super administrateur peut modifier cette discussion.",
        });
      }
      validUsers = await prisma.utilisateur.findMany({
        where: {
          id_utilisateur: { in: [...toAdd] },
          statut: "ACTIVE",
        },
        select: { id_utilisateur: true, role: { select: { nom: true } } },
      });
      if (validUsers.length !== toAdd.size) {
        return res.status(400).json({
          message: "Un ou plusieurs utilisateurs sont introuvables ou inactifs.",
        });
      }
      for (const u of validUsers) {
        if (!isEnterpriseGlobalAdminRole(u.role?.nom ?? null)) {
          return res.status(400).json({
            message:
              "Seuls les administrateurs d'entreprise (rôle global Admin) peuvent être ajoutés.",
          });
        }
      }
    } else {
      validUsers = await prisma.utilisateur.findMany({
        where: {
          id_utilisateur: { in: [...toAdd] },
          id_entreprise: entId,
          statut: "ACTIVE",
        },
        select: { id_utilisateur: true, role: { select: { nom: true } } },
      });
      if (validUsers.length !== toAdd.size) {
        return res.status(400).json({
          message: "Un ou plusieurs utilisateurs ne font pas partie de votre entreprise.",
        });
      }
    }

    for (const u of validUsers) {
      const isAdm = isTenantAdminUser({ role: u.role?.nom ?? null });
      await prisma.participant.upsert({
        where: {
          id_utilisateur_id_conversation: {
            id_utilisateur: u.id_utilisateur,
            id_conversation: conversationId,
          },
        },
        update: {},
        create: {
          id_conversation: conversationId,
          id_utilisateur: u.id_utilisateur,
          isAdmin: isAdm,
        },
      });
    }

    await prisma.conversation.update({
      where: { id_conversation: conversationId },
      data: { updatedAt: new Date() },
    });

    const conv = await prisma.conversation.findUnique({
      where: { id_conversation: conversationId },
      include: {
        participant: {
          include: {
            utilisateur: {
              select: { nom: true, prenom: true, email: true },
            },
          },
        },
        message: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      } as any,
    });
    res.json(formatConversation(conv));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de l'ajout des participants." });
  }
};

const conversationListInclude = {
  participant: {
    include: {
      utilisateur: {
        select: { nom: true, prenom: true, email: true },
      },
    },
  },
  message: {
    take: 1,
    orderBy: { createdAt: "desc" as const },
  },
};

export const updateConversation = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const conversationId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(conversationId) || conversationId < 1) {
      return res.status(400).json({ message: "ID conversation invalide." });
    }

    const gate = await assertMessagingAdminCanManageConversation(user, conversationId);
    if (!gate.ok) {
      return res.status(gate.status).json({ message: gate.message });
    }

    const body = req.body ?? {};
    const rawName = body.name ?? body.nom;
    if (rawName === undefined || rawName === null) {
      return res.status(400).json({
        message: "Le nom de la discussion est requis.",
      });
    }
    const nom = String(rawName).trim();
    if (!nom) {
      return res.status(400).json({
        message: "Le nom de la discussion est requis.",
      });
    }
    if (nom.length > 100) {
      return res.status(400).json({
        message: "Le nom de la discussion ne peut pas dépasser 100 caractères.",
      });
    }

    let description: string | null | undefined = undefined;
    if (Object.prototype.hasOwnProperty.call(body, "description")) {
      const d = body.description;
      description =
        d == null || String(d).trim() === "" ? null : String(d).trim();
    }

    const data: { nom: string; updatedAt: Date; description?: string | null } = {
      nom,
      updatedAt: new Date(),
    };
    if (description !== undefined) {
      data.description = description;
    }

    try {
      const conv = await prisma.conversation.update({
        where: { id_conversation: conversationId },
        data,
        include: conversationListInclude as any,
      });
      return res.json(formatConversation(conv));
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "P2025") {
        return res.status(404).json({ message: "Conversation introuvable." });
      }
      throw e;
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[updateConversation]", err?.message, err?.stack);
    return res.status(500).json({
      message: "Erreur lors de la mise à jour de la discussion.",
    });
  }
};

export const deleteConversation = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const conversationId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(conversationId) || conversationId < 1) {
      return res.status(400).json({ message: "ID conversation invalide." });
    }

    const gate = await assertMessagingAdminCanManageConversation(user, conversationId);
    if (!gate.ok) {
      return res.status(gate.status).json({ message: gate.message });
    }

    await prisma.conversation.delete({
      where: { id_conversation: conversationId },
    });

    return res.status(204).send();
  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    console.error("[deleteConversation]", err?.message, err?.stack);
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Conversation introuvable." });
    }
    return res.status(500).json({
      message: "Erreur lors de la suppression de la discussion.",
    });
  }
};

export const removeConversationParticipant = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const conversationId = parseInt(String(req.params.id), 10);
    const targetUserId = parseInt(String(req.params.userId), 10);
    if (
      !Number.isFinite(conversationId) ||
      conversationId < 1 ||
      !Number.isFinite(targetUserId) ||
      targetUserId < 1
    ) {
      return res.status(400).json({ message: "Paramètres invalides." });
    }

    const gate = await assertMessagingAdminCanManageConversation(user, conversationId);
    if (!gate.ok) {
      return res.status(gate.status).json({ message: gate.message });
    }

    const count = await prisma.participant.count({
      where: { id_conversation: conversationId },
    });
    if (count <= 1) {
      return res.status(400).json({
        message: "Impossible de retirer le dernier participant.",
      });
    }

    const targetRow = await prisma.participant.findUnique({
      where: {
        id_utilisateur_id_conversation: {
          id_utilisateur: targetUserId,
          id_conversation: conversationId,
        },
      },
      select: { id_participant: true },
    });
    if (!targetRow) {
      return res.status(404).json({
        message: "Ce membre ne fait pas partie de la discussion.",
      });
    }

    const convMeta = await prisma.conversation.findUnique({
      where: { id_conversation: conversationId },
      select: { id_entreprise: true, created_by_id: true },
    });
    if (convMeta?.id_entreprise == null) {
      if (convMeta?.created_by_id != null && targetUserId === convMeta.created_by_id) {
        return res.status(400).json({
          message: "Impossible de retirer le créateur de la discussion.",
        });
      }
      const targetUser = await prisma.utilisateur.findUnique({
        where: { id_utilisateur: targetUserId },
        select: { role: { select: { nom: true } } },
      });
      if (!isEnterpriseGlobalAdminRole(targetUser?.role?.nom ?? null)) {
        return res.status(400).json({
          message: "Seuls les administrateurs d'entreprise peuvent être retirés de cette discussion.",
        });
      }
    }

    const del = await prisma.participant.deleteMany({
      where: {
        id_conversation: conversationId,
        id_utilisateur: targetUserId,
      },
    });
    if (del.count === 0) {
      return res.status(404).json({
        message: "Ce membre ne fait pas partie de la discussion.",
      });
    }

    await prisma.conversation.update({
      where: { id_conversation: conversationId },
      data: { updatedAt: new Date() },
    });

    const conv = await prisma.conversation.findUnique({
      where: { id_conversation: conversationId },
      include: {
        participant: {
          include: {
            utilisateur: {
              select: { nom: true, prenom: true, email: true },
            },
          },
        },
        message: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      } as any,
    });
    res.json(formatConversation(conv));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors du retrait du participant." });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    const user = (req as any).user;
    const cid = parseInt(id, 10);
    if (!Number.isFinite(cid) || cid < 1) {
      return res.status(400).json({ message: "ID conversation invalide." });
    }

    const participant = await prisma.participant.findUnique({
      where: {
        id_utilisateur_id_conversation: {
          id_utilisateur: user.id,
          id_conversation: cid,
        },
      },
    });

    if (!participant) {
      return res.status(403).json({ message: "Vous n'avez pas accès à cette conversation" });
    }

    const messages = await prisma.message.findMany({
      where: { id_conversation: cid },
      include: {
        utilisateur: {
          select: { id_utilisateur: true, nom: true, prenom: true },
        },
        reactions: {
          select: { emoji: true, id_utilisateur: true },
        },
      } as any,
      orderBy: { createdAt: "asc" },
    });

    const formatted = messages.map((m: any) => serializeMessageDocument(m, user.id));

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la récupération des messages" });
  }
};

/** Réunion dans une discussion : Métadonnées dans `message.metadata` (clés titre, date, lien, description). */
export const createDiscussionMeeting = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const cid = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(cid) || cid < 1) {
      return res.status(400).json({ message: "ID conversation invalide." });
    }

    const conv = await prisma.conversation.findUnique({
      where: { id_conversation: cid },
      select: { id_conversation: true, is_system: true },
    });
    if (!conv) {
      return res.status(404).json({ message: "Conversation introuvable." });
    }

    const participant = await prisma.participant.findUnique({
      where: {
        id_utilisateur_id_conversation: {
          id_utilisateur: user.id,
          id_conversation: cid,
        },
      },
    });
    if (!participant) {
      return res.status(403).json({
        message: "Vous n'avez pas accès à cette conversation.",
      });
    }

    if (conv.is_system) {
      if (!isSuperAdmin(user)) {
        return res.status(403).json({
          message: "Action réservée au super administrateur.",
        });
      }
    } else {
      if (!isTenantAdminUser({ role: user.role })) {
        return res.status(403).json({
          message:
            "Seuls les administrateurs peuvent programmer une réunion dans cette discussion.",
        });
      }
    }

    const body = req.body ?? {};
    const title = String(body.title ?? body.titre ?? "").trim();
    const meetingDateRaw = body.meetingDate ?? body.date;
    const meetingLink = String(body.meetingLink ?? body.lien ?? "").trim();
    const descRaw = body.description;
    const description =
      descRaw == null || String(descRaw).trim() === ""
        ? undefined
        : String(descRaw).trim();

    if (!title) {
      return res.status(400).json({ message: "Le titre de la réunion est obligatoire." });
    }
    if (meetingDateRaw == null || String(meetingDateRaw).trim() === "") {
      return res.status(400).json({
        message: "La date et l'heure de la réunion sont obligatoires.",
      });
    }
    if (!meetingLink) {
      return res.status(400).json({ message: "Le lien de la réunion est obligatoire." });
    }

    const dateStr =
      typeof meetingDateRaw === "string"
        ? meetingDateRaw.trim()
        : String(meetingDateRaw);
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ message: "Date ou heure de réunion invalides." });
    }

    const metadata: {
      titre: string;
      date: string;
      lien: string;
      description?: string;
    } = {
      titre: title,
      date: dateStr,
      lien: meetingLink,
    };
    if (description !== undefined) {
      metadata.description = description;
    }

    const message = await prisma.message.create({
      data: {
        id_conversation: cid,
        id_expediteur: user.id,
        contenu: `📅 Réunion: ${title}`,
        type: "meeting",
        metadata: JSON.stringify(metadata),
      },
      include: {
        utilisateur: {
          select: { id_utilisateur: true, nom: true, prenom: true },
        },
      } as any,
    });

    await prisma.conversation.update({
      where: { id_conversation: cid },
      data: { updatedAt: new Date() },
    });

    const formatted = serializeMessageDocument({ ...(message as any), reactions: [] }, user.id);

    return res.status(201).json(formatted);
  } catch (error) {
    console.error("[createDiscussionMeeting]", error);
    return res.status(500).json({
      message: "Erreur lors de la création de la réunion.",
    });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { contenu, type, metadata } = req.body;

  try {
    if (!contenu || !type) {
      return res.status(400).json({ message: "Le contenu et le type sont obligatoires." });
    }

    if (String(type).toLowerCase() === "voice") {
      return res.status(400).json({
        message: "Les messages vocaux doivent être envoyés via l'upload audio.",
      });
    }

    const user = (req as any).user;
    const cid = parseInt(id, 10);
    if (!Number.isFinite(cid) || cid < 1) {
      return res.status(400).json({ message: "ID conversation invalide." });
    }

    const participant = await prisma.participant.findUnique({
      where: {
        id_utilisateur_id_conversation: {
          id_utilisateur: user.id,
          id_conversation: cid,
        },
      },
    });
    if (!participant) {
      return res.status(403).json({ message: "Vous n'avez pas accès à cette conversation" });
    }

    if (type === "meeting" && metadata) {
      const { titre, date, lien } =
        typeof metadata === "string" ? JSON.parse(metadata) : metadata;
      if (!titre || !date || !lien) {
        return res.status(400).json({
          message:
            "Les informations de réunion (titre, date, lien) sont obligatoires.",
        });
      }
    }

    const message = await prisma.message.create({
      data: {
        id_conversation: cid,
        id_expediteur: user.id,
        contenu,
        type: type || "text",
        metadata: metadata
          ? typeof metadata === "string"
            ? metadata
            : JSON.stringify(metadata)
          : null,
      },
      include: {
        utilisateur: {
          select: { id_utilisateur: true, nom: true, prenom: true },
        },
      } as any,
    });

    await prisma.conversation.update({
      where: { id_conversation: cid },
      data: { updatedAt: new Date() },
    });

    const formatted = serializeMessageDocument({ ...(message as any), reactions: [] }, user.id);

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de l'envoi du message" });
  }
};

export function messageAttachmentMulterMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  messageAttachmentUpload.single("file")(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            message: "Le fichier dépasse la taille maximale (10 Mo).",
          });
        }
      }
      const msg = err instanceof Error ? err.message : "Fichier invalide.";
      return res.status(400).json({ message: msg });
    }
    next();
  });
}

export const sendMessageAttachment = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const cid = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(cid) || cid < 1) {
      return res.status(400).json({ message: "ID conversation invalide." });
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ message: "Aucun fichier fourni." });
    }

    const participant = await prisma.participant.findUnique({
      where: {
        id_utilisateur_id_conversation: {
          id_utilisateur: user.id,
          id_conversation: cid,
        },
      },
    });
    if (!participant) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        /* ignore */
      }
      return res.status(403).json({ message: "Vous n'avez pas accès à cette conversation" });
    }

    const contenu = String((req.body as { content?: string })?.content ?? "").trim();
    const rawMime = (file.mimetype || "").toLowerCase().split(";")[0].trim();
    const mime = rawMime.startsWith("video/webm") ? "audio/webm" : rawMime;
    const originalName = path.basename(file.originalname || "fichier").slice(0, 280);
    const body = (req.body || {}) as { type?: string; messageType?: string };
    const flag = String(body.type ?? body.messageType ?? "").toLowerCase();
    const requestedVoice = flag === "voice" || flag === "audio";
    /** Détection voix : type explicite, MIME audio/ (y compris après normalisation video/webm), ou fichier audio reconnu */
    const treatAsVoice =
      requestedVoice ||
      mime.startsWith("audio/") ||
      isAllowedVoiceAttachment(originalName, file.mimetype || "").ok;

    let msgType: string;
    if (treatAsVoice) {
      const v = isAllowedVoiceAttachment(originalName || "voice-message.webm", file.mimetype || "");
      if (!v.ok) {
        try {
          fs.unlinkSync(file.path);
        } catch {
          /* ignore */
        }
        return res.status(400).json({ message: v.message });
      }
      msgType = "voice";
    } else {
      const f = isAllowedMessageAttachment(originalName || "fichier", mime);
      if (!f.ok) {
        try {
          fs.unlinkSync(file.path);
        } catch {
          /* ignore */
        }
        return res.status(400).json({ message: f.message });
      }
      msgType = mime.startsWith("image/") ? "image" : "file";
    }

    const message = await prisma.message.create({
      data: {
        id_conversation: cid,
        id_expediteur: user.id,
        contenu: contenu || (msgType === "voice" ? "🎤 Message vocal" : ""),
        type: msgType,
        metadata:
          msgType === "voice" && mime
            ? JSON.stringify({ attachmentType: mime })
            : null,
        attachmentUrl: `/uploads/messages/${file.filename}`,
        attachmentName: originalName,
        attachmentMime: mime || null,
        attachmentSize: typeof file.size === "number" ? Math.floor(file.size) : null,
      },
      include: {
        utilisateur: {
          select: { id_utilisateur: true, nom: true, prenom: true },
        },
      } as any,
    });

    await prisma.conversation.update({
      where: { id_conversation: cid },
      data: { updatedAt: new Date() },
    });

    const formatted = serializeMessageDocument({ ...(message as any), reactions: [] }, user.id);

    return res.status(201).json(formatted);
  } catch (error) {
    console.error("[sendMessageAttachment]", error);
    const file = (req as any).file as Express.Multer.File | undefined;
    if (file?.path) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        /* ignore */
      }
    }
    return res.status(500).json({ message: "Erreur lors de l'envoi de la pièce jointe." });
  }
};

export const deleteMessage = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = Number(user?.id);
    if (!Number.isFinite(userId) || userId < 1) {
      return res.status(401).json({ message: "Non authentifié." });
    }

    const cid = parseInt(String(req.params.id), 10);
    const mid = parseInt(String(req.params.messageId), 10);
    if (!Number.isFinite(cid) || cid < 1 || !Number.isFinite(mid) || mid < 1) {
      return res.status(400).json({ message: "Paramètres invalides." });
    }

    const isParticipant = await assertConversationParticipant(userId, cid);
    if (!isParticipant) {
      return res.status(403).json({ message: "Vous n'avez pas accès à cette conversation" });
    }

    const row = await prisma.message.findFirst({
      where: { id_message: mid, id_conversation: cid },
      include: {
        conversation: {
          select: { id_entreprise: true, is_system: true },
        },
      },
    });

    if (!row || row.deletedAt != null) {
      return res.status(404).json({ message: "Message introuvable." });
    }

    const conv = row.conversation;
    const isSender = row.id_expediteur === userId;
    const superMod = isSuperAdmin(user);
    const tenantMod = await canTenantAdminModerateConversation(user, conv);

    if (!isSender && !superMod && !tenantMod) {
      return res.status(403).json({ message: "Vous ne pouvez pas supprimer ce message." });
    }

    await prisma.message.update({
      where: { id_message: mid },
      data: {
        deletedAt: new Date(),
        contenu: "",
        metadata: null,
        attachmentUrl: null,
        attachmentName: null,
        attachmentMime: null,
        attachmentSize: null,
        editedAt: null,
      },
    });

    const withRels = await prisma.message.findUnique({
      where: { id_message: mid },
      include: {
        utilisateur: {
          select: { id_utilisateur: true, nom: true, prenom: true },
        },
        reactions: { select: { emoji: true, id_utilisateur: true } },
      } as any,
    });

    return res.status(200).json(serializeMessageDocument(withRels as any, userId));
  } catch (error) {
    console.error("[deleteMessage]", error);
    return res.status(500).json({ message: "Erreur lors de la suppression du message." });
  }
};

export const updateMessage = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = Number(user?.id);
    if (!Number.isFinite(userId) || userId < 1) {
      return res.status(401).json({ message: "Non authentifié." });
    }

    const cid = parseInt(String(req.params.id), 10);
    const mid = parseInt(String(req.params.messageId), 10);
    if (!Number.isFinite(cid) || cid < 1 || !Number.isFinite(mid) || mid < 1) {
      return res.status(400).json({ message: "Paramètres invalides." });
    }

    const isParticipant = await assertConversationParticipant(userId, cid);
    if (!isParticipant) {
      return res.status(403).json({ message: "Vous n'avez pas accès à cette conversation" });
    }

    const body = req.body ?? {};
    const rawContent = body.content ?? body.contenu;
    const content = String(rawContent ?? "").trim();
    if (!content) {
      return res.status(400).json({ message: "Le contenu ne peut pas être vide." });
    }

    const existing = await prisma.message.findFirst({
      where: { id_message: mid, id_conversation: cid },
    });

    if (!existing || existing.deletedAt != null) {
      return res.status(404).json({ message: "Message introuvable." });
    }

    if (existing.id_expediteur !== userId) {
      return res.status(403).json({ message: "Vous ne pouvez modifier que vos propres messages." });
    }

    if (!isEditableMessageDoc(existing)) {
      return res.status(400).json({
        message: "Ce type de message ne peut pas être modifié.",
      });
    }

    await prisma.message.update({
      where: { id_message: mid },
      data: {
        contenu: content,
        editedAt: new Date(),
      },
    });

    const withRels = await prisma.message.findUnique({
      where: { id_message: mid },
      include: {
        utilisateur: {
          select: { id_utilisateur: true, nom: true, prenom: true },
        },
        reactions: { select: { emoji: true, id_utilisateur: true } },
      } as any,
    });

    return res.status(200).json(serializeMessageDocument(withRels as any, userId));
  } catch (error) {
    console.error("[updateMessage]", error);
    return res.status(500).json({ message: "Erreur lors de la modification du message." });
  }
};

export const toggleMessageReaction = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = Number(user?.id);
    if (!Number.isFinite(userId) || userId < 1) {
      return res.status(401).json({ message: "Non authentifié." });
    }

    const cid = parseInt(String(req.params.id), 10);
    const mid = parseInt(String(req.params.messageId), 10);
    if (!Number.isFinite(cid) || cid < 1 || !Number.isFinite(mid) || mid < 1) {
      return res.status(400).json({ message: "Paramètres invalides." });
    }

    const isParticipant = await assertConversationParticipant(userId, cid);
    if (!isParticipant) {
      return res.status(403).json({ message: "Vous n'avez pas accès à cette conversation" });
    }

    const emoji = String((req.body as { emoji?: string })?.emoji ?? "").trim();
    if (!emoji || !ALLOWED_REACTION_EMOJIS.has(emoji)) {
      return res.status(400).json({ message: "Réaction non autorisée." });
    }

    const msg = await prisma.message.findFirst({
      where: { id_message: mid, id_conversation: cid },
      select: { id_message: true, deletedAt: true },
    });
    if (!msg) {
      return res.status(404).json({ message: "Message introuvable." });
    }
    if (msg.deletedAt != null) {
      return res.status(400).json({ message: "Ce message ne peut pas recevoir de réactions." });
    }

    const del = await prisma.message_reaction.deleteMany({
      where: {
        id_message: mid,
        id_utilisateur: userId,
        emoji,
      },
    });

    if (del.count === 0) {
      await prisma.message_reaction.create({
        data: {
          id_message: mid,
          id_utilisateur: userId,
          emoji,
        },
      });
    }

    const rows = await prisma.message_reaction.findMany({
      where: { id_message: mid },
      select: { emoji: true, id_utilisateur: true },
    });

    return res.status(200).json({
      reactions: aggregateReactionsForViewer(rows, userId),
    });
  } catch (error) {
    console.error("[toggleMessageReaction]", error);
    return res.status(500).json({ message: "Erreur lors de l'enregistrement de la réaction." });
  }
};
