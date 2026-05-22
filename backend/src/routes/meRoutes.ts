import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { checkAdminEntreprise } from "../middleware/checkAdminEntreprise";
import {
  getAdminRiskSummary,
  getMyPermissions,
  getPermissionsCatalog,
} from "../controllers/meController";

const router = Router();

router.use(authMiddleware);

router.get("/permissions", getMyPermissions);
router.get("/permissions/catalog", getPermissionsCatalog);
router.get("/admin/risk-summary", checkAdminEntreprise, getAdminRiskSummary);

export default router;
