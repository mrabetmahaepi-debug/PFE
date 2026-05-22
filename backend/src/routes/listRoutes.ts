import { Router } from "express";
import {
  createList,
  deleteList,
  restoreList,
  trashList,
  createListStatusHandler,
  getListById,
  getListStatuses,
  getListsByProject,
  getListsBySprint,
  getTasksByList,
  updateList,
} from "../controllers/hierarchyController";
import { authMiddleware } from "../middleware/authMiddleware";
import { authorize } from "../middleware/authorize";

const router = Router();

router.use(authMiddleware);

router.get("/projet/:id_projet", authorize("LIST_VIEW"), getListsByProject);
router.get("/:id/tasks", getTasksByList);
router.get("/:id/statuses", getListStatuses);
router.post("/:id/statuses", authorize("LIST_MANAGE"), createListStatusHandler);
router.get("/:id", getListById);
router.post("/", authorize("LIST_MANAGE"), createList);
router.post("/:id/trash", authorize("LIST_MANAGE"), trashList);
router.post("/:id/restore", authorize("LIST_MANAGE"), restoreList);
router.put("/:id", authorize("LIST_MANAGE"), updateList);
router.delete("/:id", authorize("LIST_MANAGE"), deleteList);

export default router;
