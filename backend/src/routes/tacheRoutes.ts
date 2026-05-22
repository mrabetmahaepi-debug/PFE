import { Router } from "express";
import {
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  deleteTask,
  assignTask,
  getTasksByProject,
  getTasksBySprint,
  getMyTasks,
  updateMyTaskStatus,
  getProjectProgressController,
  getUserProgressController,
  getSprintProgressController,
} from "../controllers/tacheController";
import { authMiddleware } from "../middleware/authMiddleware";
import { authorize } from "../middleware/authorize";

const router = Router();

router.get("/mes-taches", authMiddleware, getMyTasks); 
router.patch("/mes-taches/:id/statut", authMiddleware, updateMyTaskStatus); 

router.get("/progress/project/:projectId", authMiddleware, getProjectProgressController);
router.get("/progress/user/:userId", authMiddleware, getUserProgressController);
router.get("/progress/sprint/:sprintId", authMiddleware, getSprintProgressController);

router.get("/projet/:id_projet", authMiddleware, getTasksByProject);
router.get("/sprint/:id_sprint", authMiddleware, getTasksBySprint);

router.post("/", authMiddleware, createTask);
router.get("/", authMiddleware, authorize("TASK_VIEW_ALL"), getAllTasks);
router.get("/:id", authMiddleware, getTaskById); 
router.put("/:id", authMiddleware, updateTask);
router.patch("/:id", authMiddleware, updateTask);
router.delete("/:id", authMiddleware, deleteTask);
router.patch("/:id/assigner", authMiddleware, assignTask);

export default router;
