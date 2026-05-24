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
import {
  requireListWrite,
  resolveProjectIdFromCreateListBody,
  resolveProjectIdFromListParam,
} from "../middleware/requireListWrite";

const router = Router();

router.use(authMiddleware);

router.get("/projet/:id_projet", authorize("LIST_VIEW"), getListsByProject);
router.get("/:id/tasks", getTasksByList);
router.get("/:id/statuses", getListStatuses);
router.post(
  "/:id/statuses",
  requireListWrite(resolveProjectIdFromListParam),
  createListStatusHandler
);
router.get("/:id", getListById);
router.post("/", requireListWrite(resolveProjectIdFromCreateListBody), createList);
router.post("/:id/trash", requireListWrite(resolveProjectIdFromListParam), trashList);
router.post("/:id/restore", requireListWrite(resolveProjectIdFromListParam), restoreList);
router.put("/:id", requireListWrite(resolveProjectIdFromListParam), updateList);
router.delete("/:id", requireListWrite(resolveProjectIdFromListParam), deleteList);

export default router;
