import { Router } from "express";
import {
  createProjet,
  getAllProjets,
  getProjetById,
  getProjetStats,
  getProjectTree,
  getProjectTeamCandidates,
  getProjectResponsibleCandidates,
  getProjectMembers,
  updateProjet,
  archiveProjet,
  deleteProjet,
  restoreProjet,
  trashProjet,
  replaceProjetTeam,
  removeProjectTeamMember,
} from "../controllers/projetController";
import { getSprintsByProject } from "../controllers/hierarchyController";
import { assignChefProjet, updateChefProjet, assignMembersToProjet } from "../controllers/affectationController";
import {
  getMyManagedProjectsController,
  getProjectEquipeController,
  saveProjectMemberEquipeController,
  addProjectMemberEquipeController,
} from "../controllers/projectTeamAccess.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { authorize, requireAnyPermission } from "../middleware/authorize";

const router = Router();

router.use(authMiddleware);

router.post("/", authorize("PROJECT_CREATE"), createProjet);
router.get(
  "/",
  requireAnyPermission(["PROJECT_VIEW_ALL", "WORKSPACE_VIEW"]),
  getAllProjets
);
router.get("/managed/mine", getMyManagedProjectsController);
router.get(
  "/:id/tree",
  requireAnyPermission(["PROJECT_VIEW_ALL", "WORKSPACE_VIEW"]),
  getProjectTree
);
router.get(
  "/:id/sprints",
  requireAnyPermission(["PROJECT_VIEW_ALL", "WORKSPACE_VIEW"]),
  getSprintsByProject
);
router.get("/:id/equipe", getProjectEquipeController);
router.post("/:id/equipe/members", addProjectMemberEquipeController);
router.put("/:id/equipe/:userId", saveProjectMemberEquipeController);
router.get("/:id/responsible-candidates", getProjectResponsibleCandidates);
router.get("/:id/team-candidates", getProjectTeamCandidates);
router.get("/:id/members", getProjectMembers);
router.get("/:id/stats", getProjetStats);
router.get("/:id", getProjetById); // Basic view might be allowed for assigned members
router.put("/:id/team", replaceProjetTeam);
router.delete("/:id/team/:userId", removeProjectTeamMember);
router.put("/:id", updateProjet);
router.post("/:id/archive", archiveProjet);
router.post("/:id/trash", trashProjet);
router.post("/:id/restore", restoreProjet);
router.delete("/:id", deleteProjet);

router.put("/:id/update-chef", updateChefProjet);
router.post("/:id/assign-chef", assignChefProjet);
router.post("/:id/assign-members", assignMembersToProjet);

export default router;