import { Router } from "express";
import {
  getAllUtilisateurs,
  createUtilisateur,
  updateUtilisateur,
  deleteUtilisateur,
  getUtilisateurById,
} from "../controllers/utilisateurController";
import { checkAdminEntreprise } from "../middleware/checkAdminEntreprise";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);
router.use(checkAdminEntreprise);

router.get("/", getAllUtilisateurs);
router.post("/", createUtilisateur);
router.get("/:id", getUtilisateurById);
router.put("/:id", updateUtilisateur);
router.delete("/:id", deleteUtilisateur);

export default router;