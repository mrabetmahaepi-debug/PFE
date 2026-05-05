import { Router } from "express";
import {
  createEntreprise,
  getAllEntreprises,
  getEntrepriseById,
  updateEntreprise,
  deleteEntreprise,
  inviteAdmin,
  toggleEntrepriseStatus,
} from "../controllers/entrepriseControllers";
import { checkSuperAdmin } from "../middleware/checkSuperAdmin";
import { authMiddleware } from "../middleware/authMiddleware";
import { validate } from "../middleware/validate";
import { createEntrepriseSchema, updateEntrepriseSchema, paginationQuerySchema, inviteAdminSchema } from "../validations/entreprise.schema";

const router = Router();

// All routes require auth + super admin
// Static paths BEFORE dynamic /:id to avoid conflicts
router.post("/invite-admin", authMiddleware, checkSuperAdmin, validate(inviteAdminSchema), inviteAdmin);

router.post("/", authMiddleware, checkSuperAdmin, validate(createEntrepriseSchema), createEntreprise);
router.get("/", authMiddleware, checkSuperAdmin, validate(paginationQuerySchema), getAllEntreprises);
router.get("/:id", authMiddleware, checkSuperAdmin, getEntrepriseById);
router.put("/:id/toggle-status", authMiddleware, checkSuperAdmin, toggleEntrepriseStatus);
router.put("/:id", authMiddleware, checkSuperAdmin, validate(updateEntrepriseSchema), updateEntreprise);
router.delete("/:id", authMiddleware, checkSuperAdmin, deleteEntreprise);

export default router;