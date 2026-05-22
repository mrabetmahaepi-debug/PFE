import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../prisma/prismaClient';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads/profiles');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format non supporté. Utilisez PNG, JPG, JPEG ou WEBP.'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

function profileFilePathFromUrl(photoUrl: string): string | null {
  const normalized = photoUrl.trim().replace(/\\/g, '/');
  const marker = '/uploads/profiles/';
  const idx = normalized.indexOf(marker);
  if (idx === -1) return null;
  const filename = normalized.slice(idx + marker.length);
  if (!filename || filename.includes('..')) return null;
  return path.join(uploadsDir, filename);
}

async function removeStoredProfileFile(photoUrl: string | null | undefined): Promise<void> {
  if (!photoUrl?.trim()) return;
  const filePath = profileFilePathFromUrl(photoUrl);
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  } catch (err) {
    console.warn('Could not delete old profile file:', err);
  }
}

export const uploadProfilePicture = async (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const userId = req.user?.id || req.user?.id_utilisateur;
    if (!userId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const existing: { photoUrl?: string | null }[] = await prisma.$queryRawUnsafe(
      `SELECT photoUrl FROM utilisateur WHERE id_utilisateur = ?`,
      userId
    );
    const previousUrl = existing[0]?.photoUrl ?? null;
    await removeStoredProfileFile(previousUrl);

    const photoUrl = `/uploads/profiles/${req.file.filename}`;

    await prisma.$executeRawUnsafe(
      `UPDATE utilisateur SET photoUrl = ? WHERE id_utilisateur = ?`,
      photoUrl,
      userId
    );

    res.json({
      message: 'Photo de profil mise à jour',
      photoUrl,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Erreur lors de l\'upload' });
  }
};

export const deleteProfilePicture = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.id_utilisateur;
    if (!userId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const existing: { photoUrl?: string | null }[] = await prisma.$queryRawUnsafe(
      `SELECT photoUrl FROM utilisateur WHERE id_utilisateur = ?`,
      userId
    );
    const previousUrl = existing[0]?.photoUrl ?? null;
    await removeStoredProfileFile(previousUrl);

    await prisma.$executeRawUnsafe(
      `UPDATE utilisateur SET photoUrl = NULL WHERE id_utilisateur = ?`,
      userId
    );

    res.json({ message: 'Photo de profil supprimée', photoUrl: null });
  } catch (error: any) {
    console.error('Delete profile photo error:', error);
    res.status(500).json({
      error: error.message || 'Erreur lors de la suppression de la photo',
    });
  }
};

export const getProfilePicture = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.id_utilisateur;
    const result: any[] = await prisma.$queryRawUnsafe(
      `SELECT photoUrl FROM utilisateur WHERE id_utilisateur = ?`,
      userId
    );
    res.json({ photoUrl: result[0]?.photoUrl || null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
