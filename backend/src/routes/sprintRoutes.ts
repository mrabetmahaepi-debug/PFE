import { Router } from "express";
import {
  createSprint,
  getSprintsByProjet,
  getSprintById,
  updateSprint,
  deleteSprint,
} from "../controllers/sprintController";
import { authMiddleware } from "../middleware/authMiddleware";
import { checkChefProjet } from "../middleware/checkChefProjet";

const router = Router();

router.post("/", authMiddleware, checkChefProjet, createSprint);
router.get("/projet/:id_projet", authMiddleware, getSprintsByProjet);
router.get("/:id_sprint", authMiddleware, getSprintById);
router.put("/:id_sprint", authMiddleware, checkChefProjet, updateSprint);
router.delete("/:id_sprint", authMiddleware, checkChefProjet, deleteSprint);

export default router;