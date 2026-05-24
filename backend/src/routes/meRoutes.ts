import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { checkAdminEntreprise } from "../middleware/checkAdminEntreprise";
import {
  getAdminRecommendationsController,
  postAdminRecommendationApplyContextController,
  postAdminRecommendationStateController,
} from "../controllers/adminRecommendations.controller";
import {
  getUserAccessController,
  saveUserAccessController,
} from "../controllers/userAccess.controller";
import { authorize } from "../middleware/authorize";
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
router.get(
  "/admin/recommendations",
  checkAdminEntreprise,
  getAdminRecommendationsController
);
router.post(
  "/admin/recommendations/apply-context",
  checkAdminEntreprise,
  postAdminRecommendationApplyContextController
);
router.post(
  "/admin/recommendations/state",
  checkAdminEntreprise,
  postAdminRecommendationStateController
);
router.get(
  "/admin/users/:userId/access",
  checkAdminEntreprise,
  authorize("TEAM_MANAGE_ROLES"),
  getUserAccessController
);
router.put(
  "/admin/users/:userId/access",
  checkAdminEntreprise,
  authorize("TEAM_MANAGE_ROLES"),
  saveUserAccessController
);

export default router;
