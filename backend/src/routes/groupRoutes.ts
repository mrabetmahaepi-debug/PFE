import { Router } from "express";
import {
  createGroup,
  deleteGroup,
  getGroupsByProject,
  updateGroup,
} from "../controllers/hierarchyController";
import { authMiddleware } from "../middleware/authMiddleware";
import { authorize } from "../middleware/authorize";

const router = Router();

router.use(authMiddleware);

router.get("/projet/:id_projet", authorize("GROUP_VIEW"), getGroupsByProject);
router.post("/", authorize("GROUP_MANAGE"), createGroup);
router.put("/:id", authorize("GROUP_MANAGE"), updateGroup);
router.delete("/:id", authorize("GROUP_MANAGE"), deleteGroup);

export default router;
