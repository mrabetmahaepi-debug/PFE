import { Router } from "express";
import { getPendingUsers, getApprovals, approveUser, rejectUser, approveInvitation, rejectInvitation, getDashboardStats, searchGlobal } from "../controllers/superAdmin.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { checkSuperAdmin } from "../middleware/checkSuperAdmin";
import { validate } from "../middleware/validate";
import { approveUserSchema } from "../validations/entreprise.schema";

const router = Router();

router.use(authMiddleware);
router.use(checkSuperAdmin);

router.get("/search", searchGlobal);
router.get("/pending-users", getPendingUsers);
router.get("/approvals", getApprovals);
router.put("/approve/:id", validate(approveUserSchema), approveUser);
router.put("/reject/:id", rejectUser);
router.put("/approve-invitation/:id", approveInvitation);
router.put("/reject-invitation/:id", rejectInvitation);
router.get("/stats", getDashboardStats);

export default router;
