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
  const allowed = ['image/jpeg', 'image/png', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format non supporté. Utilisez JPG, PNG ou GIF.'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

export const uploadProfilePicture = async (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const userId = req.user?.id || req.user?.id_utilisateur;
    if (!userId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const photoUrl = `/uploads/profiles/${req.file.filename}`;

    // Use raw SQL to avoid Prisma client regeneration issue
    await prisma.$executeRawUnsafe(
      `UPDATE utilisateur SET photoUrl = ? WHERE id_utilisateur = ?`,
      photoUrl,
      userId
    );

    res.json({ 
      message: 'Photo de profil mise à jour',
      photoUrl 
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Erreur lors de l\'upload' });
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
