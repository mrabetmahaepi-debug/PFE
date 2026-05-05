import { Router } from "express";
import { triggerAlertCheck } from "../controllers/alertController";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.post("/check", authMiddleware, triggerAlertCheck);

export default router;
