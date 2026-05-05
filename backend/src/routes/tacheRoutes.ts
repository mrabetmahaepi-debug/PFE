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

router.get("/projet/:id_projet", authMiddleware, authorize("TASK_VIEW_ALL"), getTasksByProject);
router.get("/sprint/:id_sprint", authMiddleware, authorize("TASK_VIEW_ALL"), getTasksBySprint);

router.post("/", authMiddleware, authorize("TASK_CREATE"), createTask);
router.get("/", authMiddleware, authorize("TASK_VIEW_ALL"), getAllTasks);
router.get("/:id", authMiddleware, getTaskById); 
router.put("/:id", authMiddleware, authorize("TASK_EDIT"), updateTask);
router.delete("/:id", authMiddleware, authorize("TASK_DELETE"), deleteTask);
router.patch("/:id/assigner", authMiddleware, authorize("TASK_EDIT"), assignTask);

export default router;
