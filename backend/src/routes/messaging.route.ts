import { Router } from "express";
import { getConversations, getMessages, sendMessage } from "../controllers/messaging.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

// GET /api/messaging/conversations
router.get("/conversations", getConversations);

// GET /api/messaging/conversations/:id/messages
router.get("/conversations/:id/messages", getMessages);

// POST /api/messaging/conversations/:id/messages
router.post("/conversations/:id/messages", sendMessage);

export default router;
