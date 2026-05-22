import { Router } from 'express';
import {
  uploadProfilePicture,
  deleteProfilePicture,
  upload,
  getProfilePicture,
} from '../controllers/upload.controller';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.post('/profile-picture', authMiddleware, upload.single('photo'), uploadProfilePicture);
router.delete('/profile-picture', authMiddleware, deleteProfilePicture);
router.get('/profile-picture', authMiddleware, getProfilePicture);

export default router;
