import { Router } from "express";
import {
  getAllInvitations,
  getInvitationById,
  deleteInvitation,
  updateInvitation,
  acceptInvitation,
  createInvitation,
} from "../controllers/invitationControllers";
import { checkSuperAdmin } from "../middleware/checkSuperAdmin";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.put("/accept/:id", authMiddleware, acceptInvitation);

router.get("/", authMiddleware, checkSuperAdmin, getAllInvitations);
router.post("/", authMiddleware, checkSuperAdmin, createInvitation);
router.get("/:id", authMiddleware, getInvitationById);
router.put("/:id", authMiddleware, checkSuperAdmin, updateInvitation);
router.delete("/:id", authMiddleware, checkSuperAdmin, deleteInvitation);

export default router;
