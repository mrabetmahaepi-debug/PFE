import { Router } from "express";
import { 
  getAdmins, 
  getProjects, 
  getAdminAccess, 
  assignProject, 
  unassignProject 
} from "../controllers/access.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { checkSuperAdmin } from "../middleware/checkSuperAdmin";

const router = Router();

// Toutes les routes sont protégées et réservées au Super Admin
router.use(authMiddleware);
router.use(checkSuperAdmin);

router.get("/admins", getAdmins);
router.get("/projects", getProjects);
router.get("/admin-access/:id", getAdminAccess);
router.post("/assign", assignProject);
router.delete("/unassign", unassignProject);

export default router;
