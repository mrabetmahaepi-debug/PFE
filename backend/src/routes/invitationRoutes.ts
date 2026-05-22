import { Router } from "express";
import {
  getAllInvitations,
  getInvitationById,
  deleteInvitation,
  updateInvitation,
  acceptInvitation,
  createInvitation,
  createTeamInvitations,
  lookupInvitationByToken,
  acceptInvitationWithToken,
} from "../controllers/invitationControllers";
import { checkSuperAdmin } from "../middleware/checkSuperAdmin";
import { authMiddleware } from "../middleware/authMiddleware";
import { authorize, requireAnyPermission } from "../middleware/authorize";

const router = Router();

// Public token-based flow (no auth required)
router.get("/by-token/:token", lookupInvitationByToken);
router.post("/accept-by-token/:token", acceptInvitationWithToken);

// Tenant admin flow: send invitations to one or more emails for a tenant role.
// Forces tenant scope on the server, so a tenant admin can never invite into
// another enterprise.
router.post(
  "/team",
  authMiddleware,
  requireAnyPermission(["TEAM_INVITE", "TEAM_MANAGE_ROLES"]),
  createTeamInvitations
);

// Legacy id-based accept (kept for backward compatibility, requires auth)
router.put("/accept/:id", authMiddleware, acceptInvitation);

// Admin/SuperAdmin management
router.get("/", authMiddleware, checkSuperAdmin, getAllInvitations);
router.post("/", authMiddleware, checkSuperAdmin, createInvitation);
router.get("/:id", authMiddleware, getInvitationById);
router.put("/:id", authMiddleware, checkSuperAdmin, updateInvitation);
router.delete("/:id", authMiddleware, checkSuperAdmin, deleteInvitation);

export default router;
