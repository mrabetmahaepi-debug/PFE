import { Router } from "express";
import { createPermissions, getPermissions } from "../controllers/permissionController";
import { assignPermissionToRole, removePermissionFromRole, getRolePermissions } from "../controllers/rolePermissionController";

const router = Router();

router.post("/", createPermissions);
router.get("/", getPermissions);
router.post("/assign", assignPermissionToRole);
router.post("/remove", removePermissionFromRole);
router.get("/role/:roleId", getRolePermissions);

export default router;