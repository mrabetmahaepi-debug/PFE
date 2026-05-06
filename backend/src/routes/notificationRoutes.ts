import { Router } from 'express';
import * as notificationController from '../controllers/notificationController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authMiddleware, notificationController.getMyNotifications);
router.patch('/:id/read', authMiddleware, notificationController.markAsRead);
router.patch('/read-all', authMiddleware, notificationController.markAllAsRead);

export default router;
