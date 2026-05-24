import { Router } from "express";
import { deleteTaskCommentController } from "../controllers/tacheController";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.delete("/:commentId", authMiddleware, deleteTaskCommentController);

export default router;
