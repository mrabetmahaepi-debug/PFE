import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import multer from "multer";

export const MESSAGE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 Mo

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "messages");

export function ensureMessageUploadDir(): void {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
]);

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

/** Pièces jointes vocales (messagerie) — webm (MediaRecorder), mp3, wav, m4a */
const VOICE_EXT = new Set([".webm", ".mp3", ".wav", ".m4a", ".ogg"]);

const VOICE_MIME = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
]);

/** Multer : message unique si ni document ni audio valide */
export const MESSAGE_UPLOAD_REJECT_MESSAGE =
  "Type de fichier non autorisé. Formats acceptés : images, documents et audio (webm, mp3, wav, m4a, ogg).";

function extFromFilename(name: string): string {
  const i = name.lastIndexOf(".");
  if (i < 0) return "";
  return name.slice(i).toLowerCase();
}

export function isAllowedMessageAttachment(
  originalName: string,
  mime: string
): { ok: true; ext: string } | { ok: false; message: string } {
  const ext = extFromFilename(originalName);
  if (!ext || !ALLOWED_EXT.has(ext)) {
    return {
      ok: false,
      message:
        "Type de fichier non autorisé. Formats acceptés : images, documents et audio (webm, mp3, wav, m4a, ogg).",
    };
  }
  const m = (mime || "").toLowerCase().split(";")[0].trim();
  if (m === "application/octet-stream") {
    return { ok: true, ext };
  }
  if (!ALLOWED_MIME.has(m)) {
    return {
      ok: false,
      message: "Type MIME du fichier non autorisé.",
    };
  }
  return { ok: true, ext };
}

export function isAllowedVoiceAttachment(
  originalName: string,
  mime: string
): { ok: true; ext: string } | { ok: false; message: string } {
  const ext = extFromFilename(originalName || "");
  /** Chrome / certains navigateurs signalent parfois l’audio MediaRecorder en `video/webm` */
  let m = (mime || "").toLowerCase().split(";")[0].trim();
  if (m.startsWith("video/webm")) {
    m = "audio/webm";
  }

  const extOk = Boolean(ext && VOICE_EXT.has(ext));
  const mimeIsAudio =
    m.startsWith("audio/") ||
    VOICE_MIME.has(m) ||
    m === "application/octet-stream";

  /** Extension audio connue : accepter MIME audio, vide (navigateurs) ou octet-stream */
  if (extOk) {
    if (m === "" || mimeIsAudio) {
      return { ok: true, ext };
    }
    return {
      ok: false,
      message: "Le type du fichier ne correspond pas à une pièce audio.",
    };
  }

  /** Pas d’extension audio : n’accepter qu’avec un MIME audio explicite (audio/* ou liste blanche) */
  if (m.startsWith("audio/") || VOICE_MIME.has(m)) {
    if (m.includes("webm")) {
      return { ok: true, ext: ".webm" };
    }
    if (m.includes("ogg")) {
      return { ok: true, ext: ".ogg" };
    }
    if (m.includes("mpeg") || m.includes("mp3")) {
      return { ok: true, ext: ".mp3" };
    }
    if (m.includes("wav")) {
      return { ok: true, ext: ".wav" };
    }
    if (m.includes("m4a") || m.includes("mp4")) {
      return { ok: true, ext: ".m4a" };
    }
    if (m.startsWith("audio/")) {
      return { ok: true, ext: ".webm" };
    }
  }

  return {
    ok: false,
    message:
      "Format audio non autorisé. Formats acceptés : webm, mp3, wav, m4a, ogg.",
  };
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureMessageUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    let ext = extFromFilename(file.originalname || "");
    let m = (file.mimetype || "").toLowerCase().split(";")[0].trim();
    if (m.startsWith("video/webm")) m = "audio/webm";
    if (!ext) {
      if (m.includes("webm")) ext = ".webm";
      else if (m.includes("ogg")) ext = ".ogg";
      else if (m.includes("mpeg") || m.includes("mp3")) ext = ".mp3";
      else if (m.includes("wav")) ext = ".wav";
      else if (m.includes("m4a") || (m.startsWith("audio/") && m.includes("mp4"))) ext = ".m4a";
      else if (m.startsWith("audio/")) ext = ".webm";
    }
    cb(null, `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`);
  },
});

export const messageAttachmentUpload = multer({
  storage,
  limits: { fileSize: MESSAGE_ATTACHMENT_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    let m = (file.mimetype || "").toLowerCase().split(";")[0].trim();
    if (m.startsWith("video/webm")) {
      m = "audio/webm";
    }
    const name = file.originalname || "";

    /** Enregistrements navigateur : `audio/*` (et webm « video/ » renvoyé en audio) avant documents */
    if (m.startsWith("audio/")) {
      const v = isAllowedVoiceAttachment(name || "voice-message.webm", file.mimetype);
      if (v.ok) {
        cb(null, true);
        return;
      }
      cb(new Error(v.message));
      return;
    }

    const asFile = isAllowedMessageAttachment(name, file.mimetype);
    if (asFile.ok) {
      cb(null, true);
      return;
    }
    const asVoice = isAllowedVoiceAttachment(name, file.mimetype);
    if (asVoice.ok) {
      cb(null, true);
      return;
    }
    cb(new Error(MESSAGE_UPLOAD_REJECT_MESSAGE));
  },
});
