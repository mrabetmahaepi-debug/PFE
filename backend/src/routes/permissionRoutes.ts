import { Router } from "express";
import {
  createPermissions,
  getPermissions,
} from "../controllers/permissionController";
import {
  assignPermissionToRole,
  removePermissionFromRole,
  getRolePermissions,
} from "../controllers/rolePermissionController";
import {
  deleteProjectRolePermissionMatrix,
  getProjectRolePermissionMatrix,
  putProjectRolePermissionMatrix,
} from "../controllers/projectRolePermissionController";
import { authMiddleware } from "../middleware/authMiddleware";
import { checkSuperAdmin } from "../middleware/checkSuperAdmin";
import { authorize } from "../middleware/authorize";

const router = Router();

// SECURITY: previously these routes were public. Now protected.
// Listing permissions is allowed for any authenticated user (used to render UI).
router.get("/", authMiddleware, getPermissions);

// Mutating endpoints are restricted.
router.post("/", authMiddleware, checkSuperAdmin, createPermissions);
router.post(
  "/assign",
  authMiddleware,
  authorize("TEAM_MANAGE_ROLES"),
  assignPermissionToRole
);
router.post(
  "/remove",
  authMiddleware,
  authorize("TEAM_MANAGE_ROLES"),
  removePermissionFromRole
);
router.get(
  "/project-roles/matrix",
  authMiddleware,
  authorize("TEAM_MANAGE_ROLES"),
  getProjectRolePermissionMatrix
);
router.put(
  "/project-roles/matrix",
  authMiddleware,
  authorize("TEAM_MANAGE_ROLES"),
  putProjectRolePermissionMatrix
);
router.delete(
  "/project-roles/matrix",
  authMiddleware,
  authorize("TEAM_MANAGE_ROLES"),
  deleteProjectRolePermissionMatrix
);
router.get(
  "/role/:roleId",
  authMiddleware,
  authorize("TEAM_MANAGE_ROLES"),
  getRolePermissions
);

export default router;
