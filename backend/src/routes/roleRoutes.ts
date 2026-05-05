import { Router } from "express";
import { createRole, getRoles, updateRole, deleteRole, assignPermissionsToRole, getRoleById, removePermissionsFromRole } from "../controllers/roleController";
import { authMiddleware } from "../middleware/authMiddleware";
import { checkPermission } from "../middleware/checkPermission";

const router = Router();

router.post("/", authMiddleware, checkPermission("manage_roles"), createRole);
router.get("/entreprise/:idEntreprise", authMiddleware, checkPermission("manage_roles"), getRoles);
router.get("/:idRole", authMiddleware, checkPermission("manage_roles"), getRoleById);
router.put("/:idRole", authMiddleware, checkPermission("manage_roles"), updateRole);
router.delete("/:idRole", authMiddleware, checkPermission("manage_roles"), deleteRole);
router.post("/:idRole/permissions", authMiddleware, checkPermission("manage_roles"), assignPermissionsToRole);
router.post("/:idRole/remove-permissions", authMiddleware, checkPermission("manage_roles"), removePermissionsFromRole);

export default router;