import express from "express";
import { sendMessageToChatbotController, getMyChatHistoryController } from "../controllers/chatbot.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/", authMiddleware, sendMessageToChatbotController);
router.get("/me", authMiddleware, getMyChatHistoryController);

export default router;