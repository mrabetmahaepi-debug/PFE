import { Router } from "express";
import type { Request } from "express";
import {
  createSprint,
  getSprintsByProjet,
  getSprintById,
  updateSprint,
  deleteSprint,
  restoreSprint,
  permanentDeleteSprintController,
} from "../controllers/sprintController";
import { getListsBySprint } from "../controllers/hierarchyController";
import { authMiddleware } from "../middleware/authMiddleware";
import {
  requireAnyProjectPermission,
  requireProjectPermission,
} from "../middleware/requireProjectPermission";
import { getProjectIdForSprint } from "../services/projectPermission.service";

const router = Router();

const resolveProjectFromBody = async (req: Request) =>
  Number((req.body as { id_projet?: unknown })?.id_projet);

const resolveProjectFromSprintParam = async (req: Request) => {
  const raw = req.params.id_sprint ?? req.params.id;
  const id = Number(raw);
  if (!Number.isFinite(id)) return null;
  return getProjectIdForSprint(id);
};

const sprintWrite = requireAnyProjectPermission(
  ["SPRINT_CREATE", "SPRINT_MANAGE"],
  resolveProjectFromSprintParam
);

router.post(
  "/",
  authMiddleware,
  requireAnyProjectPermission(["SPRINT_CREATE", "SPRINT_MANAGE"], resolveProjectFromBody),
  createSprint
);
router.get(
  "/projet/:id_projet",
  authMiddleware,
  requireAnyProjectPermission(
    ["PROJECT_VIEW", "TASK_CREATE"],
    async (req) => Number(req.params.id_projet)
  ),
  getSprintsByProjet
);
router.get(
  "/:id/lists",
  authMiddleware,
  requireAnyProjectPermission(
    ["PROJECT_VIEW", "TASK_VIEW", "TASK_CREATE"],
    resolveProjectFromSprintParam
  ),
  getListsBySprint
);
router.get(
  "/:id_sprint",
  authMiddleware,
  requireAnyProjectPermission(
    ["PROJECT_VIEW", "TASK_VIEW", "TASK_CREATE"],
    resolveProjectFromSprintParam
  ),
  getSprintById
);
router.put("/:id_sprint", authMiddleware, sprintWrite, updateSprint);
router.post("/:id_sprint/restore", authMiddleware, sprintWrite, restoreSprint);
router.delete(
  "/:id_sprint/permanent",
  authMiddleware,
  sprintWrite,
  permanentDeleteSprintController
);
router.delete("/:id_sprint", authMiddleware, sprintWrite, deleteSprint);

export default router;
