import express from "express";
import { getRecommendationsController } from "../controllers/recommendation.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

router.get("/project-manager/:projectId", authMiddleware, getRecommendationsController);

export default router;