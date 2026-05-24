import prisma from "../prisma/prismaClient";

const AUTOMATED_TEST_COMMENT = /^(?:test comment |http test )\d+$/i;

function isAutomatedTestComment(contenu: string): boolean {
  return AUTOMATED_TEST_COMMENT.test(String(contenu ?? "").trim());
}

function filterRealTaskComments(rows: TaskCommentDto[]): TaskCommentDto[] {
  return rows.filter((c) => !isAutomatedTestComment(c.contenu));
}

/** MySQL DATETIME stores UTC wall-clock; node driver parses as local — rebuild UTC instant. */
function dateFromDbUtc(value: Date): Date {
  return new Date(
    Date.UTC(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      value.getHours(),
      value.getMinutes(),
      value.getSeconds(),
      value.getMilliseconds()
    )
  );
}

/** Always expose comment timestamps as UTC ISO (Z). */
function toUtcIso(value: Date | string): string {
  if (value instanceof Date) {
    return dateFromDbUtc(value).toISOString();
  }
  const trimmed = String(value).trim();
  if (!trimmed) return new Date(0).toISOString();
  if (trimmed.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed).toISOString();
  }
  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T");
  return `${normalized}${normalized.includes(".") ? "" : ".000"}Z`;
}

/** Stale Prisma client (no regen after migration) — use SQL until `npx prisma generate`. */
function hasPrismaCommentModel(): boolean {
  return typeof (prisma as unknown as { tache_comment?: { create?: unknown } })
    .tache_comment?.create === "function";
}

function hasPrismaHistoryModel(): boolean {
  return typeof (prisma as unknown as { tache_history?: { create?: unknown } })
    .tache_history?.create === "function";
}

type CommentJoinRow = {
  id_comment: number | bigint;
  id_tache: number | bigint;
  contenu: string;
  createdAt: Date;
  id_utilisateur: number | bigint;
  nom: string | null;
  prenom: string | null;
  email: string | null;
};

function mapCommentRow(row: CommentJoinRow): TaskCommentDto {
  return {
    id_comment: Number(row.id_comment),
    id_tache: Number(row.id_tache),
    contenu: row.contenu,
    createdAt: toUtcIso(row.createdAt),
    utilisateur: {
      id_utilisateur: Number(row.id_utilisateur),
      nom: row.nom,
      prenom: row.prenom,
      email: row.email,
    },
  };
}

async function getTaskCommentsRaw(taskId: number): Promise<TaskCommentDto[]> {
  const rows = await prisma.$queryRaw<CommentJoinRow[]>`
    SELECT
      c.id_comment,
      c.id_tache,
      c.contenu,
      c.createdAt,
      u.id_utilisateur,
      u.nom,
      u.prenom,
      u.email
    FROM tache_comment c
    INNER JOIN utilisateur u ON u.id_utilisateur = c.id_utilisateur
    WHERE c.id_tache = ${taskId}
    ORDER BY c.createdAt ASC
  `;
  return rows.map(mapCommentRow);
}

async function createTaskCommentRaw(
  taskId: number,
  userId: number,
  text: string
): Promise<TaskCommentDto> {
  const createdAtUtc = new Date();
  await prisma.$executeRaw`
    INSERT INTO tache_comment (id_tache, id_utilisateur, contenu, createdAt)
    VALUES (${taskId}, ${userId}, ${text}, ${createdAtUtc})
  `;
  const idRows = await prisma.$queryRaw<{ id: number | bigint }[]>`
    SELECT LAST_INSERT_ID() AS id
  `;
  const idComment = Number(idRows[0]?.id ?? 0);
  const rows = await prisma.$queryRaw<CommentJoinRow[]>`
    SELECT
      c.id_comment,
      c.id_tache,
      c.contenu,
      c.createdAt,
      u.id_utilisateur,
      u.nom,
      u.prenom,
      u.email
    FROM tache_comment c
    INNER JOIN utilisateur u ON u.id_utilisateur = c.id_utilisateur
    WHERE c.id_comment = ${idComment}
    LIMIT 1
  `;
  if (!rows[0]) {
    throw new Error("Commentaire créé mais introuvable");
  }
  const dto = mapCommentRow(rows[0]);
  return { ...dto, createdAt: createdAtUtc.toISOString() };
}

async function logCommentHistoryRaw(
  taskId: number,
  userId: number,
  text: string
): Promise<void> {
  const snippet = text.length > 200 ? `${text.slice(0, 197)}…` : text;
  await prisma.$executeRaw`
    INSERT INTO tache_history (id_tache, id_utilisateur, field_key, old_value, new_value, createdAt)
    VALUES (${taskId}, ${userId}, 'comment', NULL, ${snippet}, NOW(3))
  `;
}

const userSelect = {
  id_utilisateur: true,
  nom: true,
  prenom: true,
  email: true,
} as const;

export type TaskCommentDto = {
  id_comment: number;
  id_tache: number;
  contenu: string;
  createdAt: string;
  utilisateur: {
    id_utilisateur: number;
    nom: string | null;
    prenom: string | null;
    email: string | null;
  };
};

/** Public API JSON for task comments. */
export type TaskCommentApiResponse = {
  id: number;
  taskId: number;
  content: string;
  createdAt: string;
  user: {
    id: number;
    nom: string | null;
    prenom: string | null;
    email: string | null;
  };
};

export function commentDtoToApi(dto: TaskCommentDto): TaskCommentApiResponse {
  return {
    id: dto.id_comment,
    taskId: dto.id_tache,
    content: dto.contenu,
    createdAt: dto.createdAt,
    user: {
      id: dto.utilisateur.id_utilisateur,
      nom: dto.utilisateur.nom,
      prenom: dto.utilisateur.prenom,
      email: dto.utilisateur.email,
    },
  };
}

export type TaskHistoryDto = {
  id_history: number;
  id_tache: number;
  field_key: string;
  old_value: string | null;
  new_value: string | null;
  createdAt: string;
  utilisateur: {
    id_utilisateur: number;
    nom: string | null;
    prenom: string | null;
    email: string | null;
  } | null;
};

function formatUserLabel(u: {
  prenom?: string | null;
  nom?: string | null;
  email?: string | null;
} | null): string {
  if (!u) return "Système";
  const name = `${u.prenom || ""} ${u.nom || ""}`.trim();
  return name || u.email || "Utilisateur";
}

function serializeComment(row: {
  id_comment: number;
  id_tache: number;
  contenu: string;
  createdAt: Date;
  utilisateur: {
    id_utilisateur: number;
    nom: string | null;
    prenom: string | null;
    email: string | null;
  };
}): TaskCommentDto {
  return {
    id_comment: row.id_comment,
    id_tache: row.id_tache,
    contenu: row.contenu,
    createdAt: toUtcIso(row.createdAt),
    utilisateur: row.utilisateur,
  };
}

function serializeHistory(row: {
  id_history: number;
  id_tache: number;
  field_key: string;
  old_value: string | null;
  new_value: string | null;
  createdAt: Date;
  utilisateur: {
    id_utilisateur: number;
    nom: string | null;
    prenom: string | null;
    email: string | null;
  } | null;
}): TaskHistoryDto {
  return {
    id_history: row.id_history,
    id_tache: row.id_tache,
    field_key: row.field_key,
    old_value: row.old_value,
    new_value: row.new_value,
    createdAt: row.createdAt.toISOString(),
    utilisateur: row.utilisateur,
  };
}

export async function getTaskComments(taskId: number): Promise<TaskCommentDto[]> {
  try {
    if (hasPrismaCommentModel()) {
      const rows = await prisma.tache_comment.findMany({
        where: { id_tache: taskId },
        orderBy: { createdAt: "asc" },
        include: { utilisateur: { select: userSelect } },
      });
      return filterRealTaskComments(rows.map(serializeComment));
    }
  } catch (e) {
    console.error("[getTaskComments] Prisma failed, using SQL:", e);
  }
  return filterRealTaskComments(await getTaskCommentsRaw(taskId));
}

export async function createTaskComment(
  taskId: number,
  userId: number,
  contenu: string
): Promise<TaskCommentDto> {
  const text = String(contenu ?? "").trim();
  if (!text) {
    throw new Error("Le commentaire ne peut pas être vide");
  }
  if (isAutomatedTestComment(text)) {
    throw new Error("Ce format de commentaire n'est pas autorisé");
  }
  let result: TaskCommentDto;
  try {
    if (hasPrismaCommentModel()) {
      const createdAtUtc = new Date();
      const row = await prisma.tache_comment.create({
        data: {
          id_tache: taskId,
          id_utilisateur: userId,
          contenu: text,
          createdAt: createdAtUtc,
        },
        include: { utilisateur: { select: userSelect } },
      });
      result = {
        ...serializeComment(row),
        createdAt: createdAtUtc.toISOString(),
      };
    } else {
      result = await createTaskCommentRaw(taskId, userId, text);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[createTaskComment] Prisma error, SQL fallback:", msg);
    result = await createTaskCommentRaw(taskId, userId, text);
  }

  try {
    if (hasPrismaHistoryModel()) {
      await prisma.tache_history.create({
        data: {
          id_tache: taskId,
          id_utilisateur: userId,
          field_key: "comment",
          old_value: null,
          new_value: text.length > 200 ? `${text.slice(0, 197)}…` : text,
        },
      });
    } else {
      await logCommentHistoryRaw(taskId, userId, text);
    }
  } catch (e) {
    console.error("[createTaskComment] history log failed:", e);
  }
  return result;
}

export type TaskCommentLookup = TaskCommentDto & {
  id_projet: number | null;
};

export async function getTaskCommentById(
  commentId: number
): Promise<TaskCommentLookup | null> {
  try {
    if (hasPrismaCommentModel()) {
      const row = await prisma.tache_comment.findUnique({
        where: { id_comment: commentId },
        include: {
          utilisateur: { select: userSelect },
          tache: { select: { id_projet: true } },
        },
      });
      if (!row) return null;
      return {
        ...serializeComment(row),
        id_projet: row.tache.id_projet ?? null,
      };
    }
  } catch (e) {
    console.error("[getTaskCommentById] Prisma failed, using SQL:", e);
  }

  const rows = await prisma.$queryRaw<
    (CommentJoinRow & { id_projet: number | bigint | null })[]
  >`
    SELECT
      c.id_comment,
      c.id_tache,
      c.contenu,
      c.createdAt,
      u.id_utilisateur,
      u.nom,
      u.prenom,
      u.email,
      t.id_projet
    FROM tache_comment c
    INNER JOIN utilisateur u ON u.id_utilisateur = c.id_utilisateur
    INNER JOIN tache t ON t.id_tache = c.id_tache
    WHERE c.id_comment = ${commentId}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    ...mapCommentRow(row),
    id_projet:
      row.id_projet == null ? null : Number(row.id_projet),
  };
}

export async function deleteTaskCommentById(commentId: number): Promise<boolean> {
  try {
    if (hasPrismaCommentModel()) {
      const result = await prisma.tache_comment.deleteMany({
        where: { id_comment: commentId },
      });
      return result.count > 0;
    }
  } catch (e) {
    console.error("[deleteTaskCommentById] Prisma failed, using SQL:", e);
  }
  const affected = await prisma.$executeRaw`
    DELETE FROM tache_comment WHERE id_comment = ${commentId}
  `;
  return Number(affected) > 0;
}

type HistoryJoinRow = {
  id_history: number | bigint;
  id_tache: number | bigint;
  field_key: string;
  old_value: string | null;
  new_value: string | null;
  createdAt: Date;
  id_utilisateur: number | bigint | null;
  nom: string | null;
  prenom: string | null;
  email: string | null;
};

async function getTaskHistoryRaw(taskId: number): Promise<TaskHistoryDto[]> {
  const rows = await prisma.$queryRaw<HistoryJoinRow[]>`
    SELECT
      h.id_history,
      h.id_tache,
      h.field_key,
      h.old_value,
      h.new_value,
      h.createdAt,
      u.id_utilisateur,
      u.nom,
      u.prenom,
      u.email
    FROM tache_history h
    LEFT JOIN utilisateur u ON u.id_utilisateur = h.id_utilisateur
    WHERE h.id_tache = ${taskId}
    ORDER BY h.createdAt DESC
  `;
  return rows.map((row) =>
    serializeHistory({
      id_history: Number(row.id_history),
      id_tache: Number(row.id_tache),
      field_key: row.field_key,
      old_value: row.old_value,
      new_value: row.new_value,
      createdAt:
        row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
      utilisateur:
        row.id_utilisateur != null
          ? {
              id_utilisateur: Number(row.id_utilisateur),
              nom: row.nom,
              prenom: row.prenom,
              email: row.email,
            }
          : null,
    })
  );
}

export async function getTaskHistory(taskId: number): Promise<TaskHistoryDto[]> {
  if (hasPrismaHistoryModel()) {
    const rows = await prisma.tache_history.findMany({
      where: { id_tache: taskId },
      orderBy: { createdAt: "desc" },
      include: { utilisateur: { select: userSelect } },
    });
    return rows.map(serializeHistory);
  }
  return getTaskHistoryRaw(taskId);
}

function strVal(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function dateVal(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  try {
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

/** Record field changes after a task update (member activity feed). */
export async function logTaskFieldChanges(params: {
  taskId: number;
  userId: number | null;
  before: {
    nom_t?: string | null;
    description_t?: string | null;
    statut_t?: string | null;
    priorite_t?: string | null;
    assigne_a?: number | null;
    date_debut_t?: Date | null;
    date_limite_t?: Date | null;
  };
  after: {
    nom_t?: string | null;
    description_t?: string | null;
    statut_t?: string | null;
    priorite_t?: string | null;
    assigne_a?: number | null;
    date_debut_t?: Date | null;
    date_limite_t?: Date | null;
  };
  assigneeLabels?: Map<number, string>;
}): Promise<void> {
  const { taskId, userId, before, after, assigneeLabels } = params;
  const entries: {
    field_key: string;
    old_value: string | null;
    new_value: string | null;
  }[] = [];

  const assigneeStr = (id: number | null | undefined) => {
    if (id == null) return null;
    return assigneeLabels?.get(Number(id)) ?? `Utilisateur #${id}`;
  };

  if (before.nom_t !== after.nom_t && after.nom_t !== undefined) {
    entries.push({
      field_key: "nom_t",
      old_value: strVal(before.nom_t),
      new_value: strVal(after.nom_t),
    });
  }
  if (
    before.description_t !== after.description_t &&
    after.description_t !== undefined
  ) {
    entries.push({
      field_key: "description_t",
      old_value: strVal(before.description_t),
      new_value: strVal(after.description_t),
    });
  }
  if (before.statut_t !== after.statut_t && after.statut_t !== undefined) {
    entries.push({
      field_key: "statut_t",
      old_value: strVal(before.statut_t),
      new_value: strVal(after.statut_t),
    });
  }
  if (before.priorite_t !== after.priorite_t && after.priorite_t !== undefined) {
    entries.push({
      field_key: "priorite_t",
      old_value: strVal(before.priorite_t),
      new_value: strVal(after.priorite_t),
    });
  }
  if (before.assigne_a !== after.assigne_a && after.assigne_a !== undefined) {
    entries.push({
      field_key: "assigne_a",
      old_value: assigneeStr(before.assigne_a),
      new_value: assigneeStr(after.assigne_a),
    });
  }
  const oldStart = dateVal(before.date_debut_t);
  const newStart = dateVal(after.date_debut_t);
  if (oldStart !== newStart && after.date_debut_t !== undefined) {
    entries.push({
      field_key: "date_debut_t",
      old_value: oldStart,
      new_value: newStart,
    });
  }
  const oldDue = dateVal(before.date_limite_t);
  const newDue = dateVal(after.date_limite_t);
  if (oldDue !== newDue && after.date_limite_t !== undefined) {
    entries.push({
      field_key: "date_limite_t",
      old_value: oldDue,
      new_value: newDue,
    });
  }

  if (entries.length === 0) return;

  if (hasPrismaHistoryModel()) {
    await prisma.tache_history.createMany({
      data: entries.map((e) => ({
        id_tache: taskId,
        id_utilisateur: userId,
        field_key: e.field_key,
        old_value: e.old_value,
        new_value: e.new_value,
      })),
    });
    return;
  }

  for (const e of entries) {
    await prisma.$executeRaw`
      INSERT INTO tache_history (id_tache, id_utilisateur, field_key, old_value, new_value, createdAt)
      VALUES (${taskId}, ${userId}, ${e.field_key}, ${e.old_value}, ${e.new_value}, NOW(3))
    `;
  }
}

export function historyEntryLabel(
  fieldKey: string,
  value: string | null
): string {
  if (!value) return "—";
  if (fieldKey === "statut_t") {
    const map: Record<string, string> = {
      todo: "À FAIRE",
      en_cours: "EN COURS",
      en_retard: "EN RETARD",
      terminee: "TERMINÉ",
    };
    return map[value] ?? value.toUpperCase();
  }
  if (fieldKey === "priorite_t") {
    const map: Record<string, string> = {
      LOW: "Basse",
      MEDIUM: "Moyenne",
      HIGH: "Haute",
      URGENT: "Urgente",
    };
    return map[value.toUpperCase()] ?? value;
  }
  if (fieldKey === "comment") return value;
  return value;
}

export function historyActionLabel(
  fieldKey: string,
  oldVal: string | null,
  newVal: string | null
): string {
  switch (fieldKey) {
    case "statut_t":
      return `Statut : ${historyEntryLabel(fieldKey, oldVal)} → ${historyEntryLabel(fieldKey, newVal)}`;
    case "priorite_t":
      return `Priorité : ${historyEntryLabel(fieldKey, oldVal)} → ${historyEntryLabel(fieldKey, newVal)}`;
    case "assigne_a":
      return `Assigné : ${oldVal || "—"} → ${newVal || "—"}`;
    case "date_debut_t":
      return `Date de début : ${oldVal || "—"} → ${newVal || "—"}`;
    case "date_limite_t":
      return `Date d'échéance : ${oldVal || "—"} → ${newVal || "—"}`;
    case "description_t":
      return "Description mise à jour";
    case "nom_t":
      return `Titre : ${oldVal || "—"} → ${newVal || "—"}`;
    case "comment":
      return "Commentaire ajouté";
    default:
      return "Modification";
  }
}

export { formatUserLabel };
