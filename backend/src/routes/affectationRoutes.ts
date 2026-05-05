import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { checkAdminEntreprise } from "../middleware/checkAdminEntreprise";
import { assignMembers } from "../controllers/affectationController";

const router = Router();

router.use(authMiddleware);

router.post("/members", checkAdminEntreprise, assignMembers);

export default router;