import { Router } from "express";
import { getActivities } from "../controllers/activityController";
import { authMiddleware } from "../middleware/authMiddleware";
import { checkSuperAdmin } from "../middleware/checkSuperAdmin";

const router = Router();

router.get("/", authMiddleware, checkSuperAdmin, getActivities);

export default router;
