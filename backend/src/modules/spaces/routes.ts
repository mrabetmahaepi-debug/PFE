import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import {
  createSpace,
  deleteSpace,
  getProjectsBySpace,
  getSpacesHierarchy,
  getWorkspaceTrash,
  listSpaces,
  restoreSpace,
  trashSpace,
  updateSpace,
} from "../../controllers/spaceController";

const router = Router();

router.use(authMiddleware);

router.get("/hierarchy", getSpacesHierarchy);
router.get("/trash", getWorkspaceTrash);
router.get("/:id/projects", getProjectsBySpace);
router.get("/", listSpaces);
router.post("/", createSpace);
router.put("/:id", updateSpace);
router.post("/:id/trash", trashSpace);
router.post("/:id/restore", restoreSpace);
router.delete("/:id", deleteSpace);

export default router;
