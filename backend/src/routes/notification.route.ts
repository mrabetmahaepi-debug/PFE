import express from "express";
import {
  getMyNotificationsController,
  getUnreadCountController,
  createNotificationController,
  markAsReadController,
  markAllAsReadController,
  deleteNotificationController,
  deleteAllNotificationsController,
} from "../controllers/notification.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

router.get("/me", authMiddleware, getMyNotificationsController);
router.get("/unread-count", authMiddleware, getUnreadCountController);
router.post("/", authMiddleware, createNotificationController);
router.patch("/read", authMiddleware, markAllAsReadController);
router.put("/read-all", authMiddleware, markAllAsReadController);
router.patch("/:id/read", authMiddleware, markAsReadController);
router.put("/:id/read", authMiddleware, markAsReadController);
router.delete("/all", authMiddleware, deleteAllNotificationsController);
router.delete("/:id", authMiddleware, deleteNotificationController);

export default router;