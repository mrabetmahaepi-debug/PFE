import { Router } from "express";
import {
  createFolder,
  deleteFolder,
  getFoldersByProject,
  updateFolder,
} from "../controllers/hierarchyController";
import { authMiddleware } from "../middleware/authMiddleware";
import { authorize, requireAnyPermission } from "../middleware/authorize";

const router = Router();

router.use(authMiddleware);

router.get("/projet/:id_projet", authorize("FOLDER_VIEW"), getFoldersByProject);
router.post(
  "/",
  requireAnyPermission(["FOLDER_MANAGE", "PROJECT_CREATE"]),
  createFolder
);
router.put("/:id", authorize("FOLDER_MANAGE"), updateFolder);
router.delete("/:id", authorize("FOLDER_MANAGE"), deleteFolder);

export default router;
