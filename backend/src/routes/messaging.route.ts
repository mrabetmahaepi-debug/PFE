import { Router } from "express";
import {
  getConversations,
  getConversationById,
  getMessages,
  sendMessage,
  getTeamMembersForMessaging,
  createConversation,
  addConversationParticipants,
  removeConversationParticipant,
  deleteConversation,
  updateConversation,
  createDiscussionMeeting,
  messageAttachmentMulterMiddleware,
  sendMessageAttachment,
  deleteMessage,
  updateMessage,
  toggleMessageReaction,
} from "../controllers/messaging.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

// Routes spécifiques avant :id
router.get("/conversations/team-members", getTeamMembersForMessaging);
router.post("/conversations", createConversation);
router.get("/conversations", getConversations);

router.get("/conversations/:id/messages", getMessages);
router.delete("/conversations/:id/messages/:messageId", deleteMessage);
router.patch("/conversations/:id/messages/:messageId", updateMessage);
router.post("/conversations/:id/messages/:messageId/reactions", toggleMessageReaction);
router.get("/conversations/:id", getConversationById);
router.patch("/conversations/:id", updateConversation);
router.post("/conversations/:id/meetings", createDiscussionMeeting);
router.post(
  "/conversations/:id/messages/attachment",
  messageAttachmentMulterMiddleware,
  sendMessageAttachment
);
router.post("/conversations/:id/messages", sendMessage);
router.post("/conversations/:id/participants", addConversationParticipants);
router.delete("/conversations/:id/participants/:userId", removeConversationParticipant);
router.delete("/conversations/:id", deleteConversation);

export default router;
