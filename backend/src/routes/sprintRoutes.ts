import { Router } from "express";
import type { Request } from "express";
import {
  createSprint,
  getSprintsByProjet,
  getSprintById,
  updateSprint,
  deleteSprint,
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
  const id = Number(req.params.id_sprint);
  if (!Number.isFinite(id)) return null;
  return getProjectIdForSprint(id);
};

const sprintWrite = requireAnyProjectPermission(
  ["create_sprints", "manage_sprints"],
  resolveProjectFromSprintParam
);

router.post(
  "/",
  authMiddleware,
  requireAnyProjectPermission(["create_sprints", "manage_sprints"], resolveProjectFromBody),
  createSprint
);
router.get(
  "/projet/:id_projet",
  authMiddleware,
  requireAnyProjectPermission(
    ["view_project", "create_tasks"],
    async (req) => Number(req.params.id_projet)
  ),
  getSprintsByProjet
);
router.get("/:id/lists", authMiddleware, getListsBySprint);
router.get(
  "/:id_sprint",
  authMiddleware,
  getSprintById
);
router.put("/:id_sprint", authMiddleware, sprintWrite, updateSprint);
router.delete("/:id_sprint", authMiddleware, sprintWrite, deleteSprint);

export default router;
