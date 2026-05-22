import { Router } from "express";
import {
  createRole,
  getRoles,
  updateRole,
  deleteRole,
  assignPermissionsToRole,
  getRoleById,
  removePermissionsFromRole,
  getAssignableRoles,
} from "../controllers/roleController";
import { authMiddleware } from "../middleware/authMiddleware";
import { authorize, requireAnyPermission } from "../middleware/authorize";

const router = Router();

// FIX: previously used permission name "manage_roles" which never existed in
// the seed-permissions.ts. Now uses TEAM_MANAGE_ROLES which exists.
const requireRoleManagement = authorize("TEAM_MANAGE_ROLES");

// Lightweight, tenant-scoped role list usable by anyone who can invite or
// manage the team. Must be declared before the parametrized routes below
// so `/assignable` is not captured by `/:idRole`.
router.get(
  "/assignable",
  authMiddleware,
  requireAnyPermission(["TEAM_INVITE", "TEAM_MANAGE_ROLES"]),
  getAssignableRoles
);

router.post("/", authMiddleware, requireRoleManagement, createRole);
router.get(
  "/entreprise/:idEntreprise",
  authMiddleware,
  requireRoleManagement,
  getRoles
);
router.get("/:idRole", authMiddleware, requireRoleManagement, getRoleById);
router.put("/:idRole", authMiddleware, requireRoleManagement, updateRole);
router.delete("/:idRole", authMiddleware, requireRoleManagement, deleteRole);
router.post(
  "/:idRole/permissions",
  authMiddleware,
  requireRoleManagement,
  assignPermissionsToRole
);
router.post(
  "/:idRole/remove-permissions",
  authMiddleware,
  requireRoleManagement,
  removePermissionsFromRole
);

export default router;
