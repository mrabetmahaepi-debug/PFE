import { Router } from "express";
import {
  createProjet,
  getAllProjets,
  getProjetById,
  updateProjet,
  deleteProjet,
} from "../controllers/projetController";
import { assignChefProjet, assignMembersToProjet } from "../controllers/affectationController";
import { authMiddleware } from "../middleware/authMiddleware";
import { authorize } from "../middleware/authorize";

const router = Router();

router.use(authMiddleware);

router.post("/", authorize("PROJECT_CREATE"), createProjet);
router.get("/", authorize("PROJECT_VIEW_ALL"), getAllProjets);
router.get("/:id", getProjetById);
router.put("/:id", authorize("PROJECT_EDIT"), updateProjet);
router.delete("/:id", authorize("PROJECT_DELETE"), deleteProjet);

router.post("/:id/assign-chef", authorize("PROJECT_EDIT"), assignChefProjet);
router.post("/:id/assign-members", authorize("PROJECT_EDIT"), assignMembersToProjet);

export default router;