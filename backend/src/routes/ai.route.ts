import express from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import {
  getTaskAssistantStatusController,
  postTaskAssistantController,
} from "../controllers/taskAssistant.controller";

const router = express.Router();

router.get("/task-assistant/status", authMiddleware, getTaskAssistantStatusController);
router.post("/task-assistant", authMiddleware, postTaskAssistantController);

export default router;
