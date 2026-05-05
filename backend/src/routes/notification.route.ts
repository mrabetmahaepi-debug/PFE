import express from "express";
import {
  getMyNotificationsController,
  createNotificationController,
  markAsReadController,
  markAllAsReadController
} from "../controllers/notification.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

router.get("/me", authMiddleware, getMyNotificationsController);
router.post("/", authMiddleware, createNotificationController);
router.put("/read-all", authMiddleware, markAllAsReadController);
router.put("/:id/read", authMiddleware, markAsReadController);

export default router;