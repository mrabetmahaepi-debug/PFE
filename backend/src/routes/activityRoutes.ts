import { Router } from "express";
import {
  getActivities,
  getEnterpriseActivities,
  getMemberActivities,
} from "../controllers/activityController";
import { authMiddleware } from "../middleware/authMiddleware";
import { checkSuperAdmin } from "../middleware/checkSuperAdmin";
import { checkAdminEntreprise } from "../middleware/checkAdminEntreprise";

const router = Router();

router.get("/member", authMiddleware, getMemberActivities);
router.get("/enterprise", authMiddleware, checkAdminEntreprise, getEnterpriseActivities);
router.get("/", authMiddleware, checkSuperAdmin, getActivities);

export default router;
