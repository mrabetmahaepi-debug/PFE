import express from "express";
import { getMyBadgesController } from "../controllers/badge.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

router.get("/me", authMiddleware, getMyBadgesController);

export default router;